import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { LucideSearch } from '@lucide/angular';
import { TICKET_STATUS_LABELS, TICKET_STATUSES, type Ticket, type TicketStatus } from '@vitalia/contracts';
import { catchError, of, startWith, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { TicketsApi } from '../../core/api/tickets.api';
import { QueueStore } from '../../core/live/queue.store';
import { hhmm } from '../../core/time/clock.service';
import { LevelPill } from '../../shared/level-pill';
import { TicketActions } from '../../shared/ticket-actions';

/** Filtra por estado y por texto (código, paciente, servicio o consultorio). */
export function filterTickets(list: Ticket[], status: TicketStatus | null, text: string): Ticket[] {
  const q = text.trim().toLowerCase();
  return list.filter(
    (t) =>
      (!status || t.status === status) &&
      (!q ||
        [t.code, t.patient.displayName, t.service.name, t.consultingRoom?.name ?? ''].some((v) =>
          v.toLowerCase().includes(q),
        )),
  );
}

/** Todos los turnos del día, incluidos los cerrados, con filtro por estado y búsqueda. */
@Component({
  selector: 'vt-tickets',
  imports: [MatProgressBarModule, LevelPill, TicketActions, LucideSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tickets.html',
  styleUrl: './tickets.scss',
})
export class Tickets {
  private readonly api = inject(TicketsApi);
  protected readonly statusLabels = TICKET_STATUS_LABELS;
  protected readonly statuses = TICKET_STATUSES;
  protected readonly hhmm = hhmm;

  protected readonly all = signal<Ticket[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<TicketStatus | null>(null);
  protected readonly text = signal('');

  protected readonly counts = computed(() => {
    const c = new Map<TicketStatus, number>();
    for (const t of this.all() ?? []) c.set(t.status, (c.get(t.status) ?? 0) + 1);
    return c;
  });
  protected readonly view = computed(() =>
    filterTickets(this.all() ?? [], this.status(), this.text()).sort((a, b) =>
      b.checkedInAt.localeCompare(a.checkedInAt),
    ),
  );

  constructor() {
    inject(QueueStore)
      .changes$.pipe(
        startWith(undefined),
        switchMap(() =>
          this.api.list(TICKET_STATUSES).pipe(
            catchError((err: unknown) => {
              this.error.set(apiErrorMessage(err, 'No se pudieron cargar los turnos'));
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((list) => {
        if (!list) return;
        this.error.set(null);
        this.all.set(list);
      });
  }

  protected onSearch(e: Event): void {
    this.text.set((e.target as HTMLInputElement).value);
  }
}
