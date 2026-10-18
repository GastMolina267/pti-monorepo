import { HttpErrorResponse } from '@angular/common/http';
import { computed, type DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  REALTIME_EVENTS,
  type Alert,
  type AlertAcknowledgedEvent,
  type AlertEmergencyEvent,
} from '@vitalia/contracts';
import { catchError, EMPTY, firstValueFrom, switchMap } from 'rxjs';
import { AlertsApi } from '../api/alerts.api';
import { RealtimeService } from '../realtime/realtime.service';
import { AlarmService } from '../sound/alarm.service';
import { QueueStore } from './queue.store';

const FRESH_MS = 10_000;

/** Convierte el evento en tiempo real a la forma de `GET /api/alerts`. */
export function alertFromEvent(e: AlertEmergencyEvent, patientDisplayName: string | null): Alert {
  return {
    id: e.alertId,
    kind: e.kind,
    level: e.level,
    status: 'ACTIVE',
    message: e.message,
    wearableId: e.wearableId,
    ticketId: e.ticketId ?? null,
    ticketCode: e.ticketCode ?? null,
    patientDisplayName,
    detectedAt: e.detectedAt,
    acknowledgedAt: null,
    acknowledgedBy: null,
  };
}

/** Inserta sin duplicar y deja la más reciente primero. */
export function mergeAlerts(list: Alert[], incoming: Alert[]): Alert[] {
  const byId = new Map(list.map((a) => [a.id, a]));
  for (const a of incoming) byId.set(a.id, a);
  return [...byId.values()].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
}

/**
 * Alertas activas en vivo (RF-O4). `alert:emergency` entra al instante, sin esperar a la API;
 * `alert:acknowledged` (de cualquier puesto) la saca. Mientras haya alertas sin minimizar,
 * suena la alarma y se muestra el aviso rojo (`AlertOverlay`).
 */
@Injectable({ providedIn: 'root' })
export class AlertsStore {
  private readonly api = inject(AlertsApi);
  private readonly realtime = inject(RealtimeService);
  private readonly alarm = inject(AlarmService);
  private readonly queue = inject(QueueStore);

  readonly active = signal<Alert[]>([]);
  /** Alertas que el usuario minimizó: no suenan ni tapan la pantalla, pero siguen activas. */
  private readonly minimized = signal<ReadonlySet<string>>(new Set());
  private readonly acking = signal<ReadonlySet<string>>(new Set());

  /** Las que todavía reclaman atención (overlay + alarma). */
  readonly pending = computed(() => this.active().filter((a) => !this.minimized().has(a.id)));
  readonly count = computed(() => this.active().length);

  constructor() {
    effect(() => this.alarm.active.set(this.pending().length > 0));
  }

  start(destroyRef: DestroyRef): void {
    this.active.set([]);
    this.minimized.set(new Set());
    this.reload();

    this.realtime
      .on<AlertEmergencyEvent>(REALTIME_EVENTS.ALERT_EMERGENCY)
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((e) => {
        const ticket = e.ticketId ? this.queue.tickets().find((t) => t.id === e.ticketId) : undefined;
        this.active.update((l) => mergeAlerts(l, [alertFromEvent(e, ticket?.patient.displayName ?? null)]));
      });

    this.realtime
      .on<AlertAcknowledgedEvent>(REALTIME_EVENTS.ALERT_ACKNOWLEDGED)
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((e) => this.remove(e.alertId));

    // Al reconectar, la base ya tiene todo lo que pasó mientras tanto.
    this.realtime.ready$
      .pipe(
        switchMap(() => this.api.list(true).pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((list) => this.replaceWith(list));
  }

  reload(): void {
    this.api
      .list(true)
      .pipe(catchError(() => EMPTY))
      .subscribe((list) => this.replaceWith(list));
  }

  isAcking(id: string): boolean {
    return this.acking().has(id);
  }

  async acknowledge(alert: Alert): Promise<void> {
    this.acking.update((s) => new Set(s).add(alert.id));
    try {
      await firstValueFrom(this.api.acknowledge(alert.id));
      this.remove(alert.id);
    } catch (err) {
      // 409: otro puesto la reconoció primero. 404: ya no existe. En ambos casos, sacarla.
      if (err instanceof HttpErrorResponse && (err.status === 409 || err.status === 404))
        this.remove(alert.id);
      else throw err;
    } finally {
      this.acking.update((s) => {
        const next = new Set(s);
        next.delete(alert.id);
        return next;
      });
    }
  }

  /** Oculta el aviso y silencia la alarma de las alertas actuales (una nueva vuelve a sonar). */
  minimizeAll(): void {
    this.minimized.set(new Set(this.active().map((a) => a.id)));
  }

  /**
   * Reemplaza por lo que dice la API, pero conserva las recién llegadas por WebSocket:
   * la alerta se emite antes de guardarse y puede no estar todavía en la respuesta.
   */
  private replaceWith(list: Alert[]): void {
    const fresh = Date.now() - FRESH_MS;
    this.active.update((l) =>
      mergeAlerts(
        l.filter((a) => new Date(a.detectedAt).getTime() > fresh),
        list,
      ),
    );
  }

  private remove(id: string): void {
    this.active.update((l) => l.filter((a) => a.id !== id));
  }
}
