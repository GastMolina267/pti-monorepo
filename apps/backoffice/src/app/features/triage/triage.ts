import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import {
  LucideBellRing,
  LucideClock,
  LucideRefreshCw,
  LucideTriangleAlert,
  LucideUsers,
  LucideWatch,
} from '@lucide/angular';
import { TICKET_STATUS_LABELS, type Ticket } from '@vitalia/contracts';
import { AlertsStore } from '../../core/live/alerts.store';
import { QueueStore } from '../../core/live/queue.store';
import { WearablesStore, type WearableView } from '../../core/live/wearables.store';
import { ago, ClockService, hhmm, minutesSince } from '../../core/time/clock.service';
import { LevelPill } from '../../shared/level-pill';
import { TicketActions } from '../../shared/ticket-actions';
import { Vitals } from '../../shared/vitals';

export interface TriageRow {
  ticket: Ticket;
  wearable: WearableView | null;
  /** Motivo más grave de la última lectura (o el nivel manual si no hay pulsera). */
  reason: string | null;
}

/** Une cada turno con su pulsera (si tiene) para mostrar signos vitales y motivos. */
export function toRows(tickets: Ticket[], byTicket: ReadonlyMap<string, WearableView>): TriageRow[] {
  return tickets.map((ticket) => {
    const wearable = byTicket.get(ticket.id) ?? null;
    return { ticket, wearable, reason: wearable?.assessment?.reasons[0] ?? null };
  });
}

/**
 * Fila de triaje en vivo (RF-O4): en espera ordenada por triaje y llegada, con los signos
 * vitales de la pulsera; abajo, los turnos llamados y en atención.
 */
@Component({
  selector: 'vt-triage',
  imports: [
    MatProgressBarModule,
    RouterLink,
    LevelPill,
    TicketActions,
    Vitals,
    LucideBellRing,
    LucideClock,
    LucideRefreshCw,
    LucideTriangleAlert,
    LucideUsers,
    LucideWatch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './triage.html',
  styleUrl: './triage.scss',
})
export class Triage {
  protected readonly queue = inject(QueueStore);
  protected readonly wearables = inject(WearablesStore);
  protected readonly alerts = inject(AlertsStore);
  private readonly clock = inject(ClockService);

  protected readonly statusLabels = TICKET_STATUS_LABELS;
  protected readonly service = signal<string | null>(null);

  protected readonly services = computed(() => {
    const map = new Map(this.queue.tickets().map((t) => [t.service.code, t.service.name]));
    return [...map].map(([code, name]) => ({ code, name }));
  });

  private readonly inService = (t: Ticket) => !this.service() || t.service.code === this.service();

  protected readonly waiting = computed(() =>
    toRows(this.queue.waiting().filter(this.inService), this.wearables.byTicket()),
  );
  protected readonly inCare = computed(() =>
    toRows(this.queue.inCare().filter(this.inService), this.wearables.byTicket()),
  );

  protected wait(t: Ticket): number {
    return minutesSince(t.checkedInAt, this.clock.now());
  }
  protected seen(w: WearableView): string {
    return ago(w.lastSeenAt, this.clock.now());
  }
  protected readonly hhmm = hhmm;
}
