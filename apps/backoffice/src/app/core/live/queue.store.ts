import { computed, type DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  compareQueueOrder,
  OPEN_TICKET_STATUSES,
  REALTIME_EVENTS,
  type Ticket,
  type TicketStatus,
  type TriageLevel,
} from '@vitalia/contracts';
import {
  catchError,
  debounceTime,
  EMPTY,
  firstValueFrom,
  map,
  merge,
  type Observable,
  share,
  switchMap,
} from 'rxjs';
import { TicketsApi } from '../api/tickets.api';
import { apiErrorMessage } from '../api/api-error';
import { RealtimeService } from '../realtime/realtime.service';

/** Llamados y en atención: el más reciente arriba. */
function byCalledDesc(a: Ticket, b: Ticket): number {
  return (b.calledAt ?? '').localeCompare(a.calledAt ?? '');
}

/**
 * Fila del día (turnos abiertos) en vivo. Se recarga ante `queue:updated` / `ticket:called`
 * (con debounce: varios cambios seguidos = un solo pedido) y al reconectar el socket.
 * `queue:updated` es solo un aviso sin datos clínicos: el detalle sale de `GET /api/tickets`.
 */
@Injectable({ providedIn: 'root' })
export class QueueStore {
  private readonly api = inject(TicketsApi);
  private readonly realtime = inject(RealtimeService);

  readonly tickets = signal<Ticket[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** En espera, en el orden de la fila (triaje → llegada, `compareQueueOrder`). */
  readonly waiting = computed(() =>
    this.tickets()
      .filter((t) => t.status === 'WAITING')
      .sort(compareQueueOrder),
  );
  /** Llamados o en atención. */
  readonly inCare = computed(() =>
    this.tickets()
      .filter((t) => t.status === 'CALLED' || t.status === 'IN_PROGRESS')
      .sort(byCalledDesc),
  );
  readonly criticalCount = computed(() => this.tickets().filter((t) => t.triageLevel === 'CRITICAL').length);

  /** Cualquier cambio de la fila (con debounce). Lo usan otras vistas para refrescarse. */
  readonly changes$: Observable<void> = merge(
    this.realtime.on(REALTIME_EVENTS.QUEUE_UPDATED),
    this.realtime.on(REALTIME_EVENTS.TICKET_CALLED),
    this.realtime.ready$,
  ).pipe(
    debounceTime(250),
    map(() => undefined),
    share(),
  );

  start(destroyRef: DestroyRef): void {
    this.tickets.set([]);
    this.reload();
    this.changes$
      .pipe(
        switchMap(() => this.fetch()),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((list) => this.tickets.set(list));
  }

  reload(): void {
    this.loading.set(true);
    this.fetch().subscribe((list) => this.tickets.set(list));
  }

  async call(ticket: Ticket, consultingRoomId: string): Promise<Ticket> {
    return this.upsert(await firstValueFrom(this.api.call(ticket.id, consultingRoomId)));
  }

  async setStatus(ticket: Ticket, status: TicketStatus): Promise<Ticket> {
    return this.upsert(await firstValueFrom(this.api.updateStatus(ticket.id, status)));
  }

  async setTriage(ticket: Ticket, level: TriageLevel): Promise<Ticket> {
    return this.upsert(await firstValueFrom(this.api.updateTriage(ticket.id, level)));
  }

  private fetch(): Observable<Ticket[]> {
    return this.api.list().pipe(
      map((list) => {
        this.loading.set(false);
        this.error.set(null);
        return list;
      }),
      catchError((err: unknown) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'No se pudo cargar la fila'));
        return EMPTY;
      }),
    );
  }

  /** Aplica la respuesta de una acción sin esperar al refresco por WebSocket. */
  private upsert(ticket: Ticket): Ticket {
    this.tickets.update((list) => {
      const rest = list.filter((t) => t.id !== ticket.id);
      return OPEN_TICKET_STATUSES.includes(ticket.status) ? [...rest, ticket] : rest;
    });
    return ticket;
  }
}
