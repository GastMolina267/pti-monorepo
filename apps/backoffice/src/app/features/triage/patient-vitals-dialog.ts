import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  ALERT_KIND_LABELS,
  REALTIME_EVENTS,
  type TelemetryReadingEvent,
  type Ticket,
  type VitalsHistory,
} from '@vitalia/contracts';
import { catchError, filter, interval, merge, of, startWith, switchMap, tap, throttleTime } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { TicketsApi } from '../../core/api/tickets.api';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { hhmm } from '../../core/time/clock.service';
import { LevelPill } from '../../shared/level-pill';
import { VitalsChart } from '../../shared/vitals-chart';

const WINDOWS = [
  { minutes: 30, label: '30 min' },
  { minutes: 120, label: '2 h' },
  { minutes: 480, label: '8 h' },
  { minutes: 1440, label: '24 h' },
] as const;

/** Detalle clínico del turno: curva de signos vitales en vivo, alertas y vista de tabla. */
@Component({
  selector: 'vt-patient-vitals-dialog',
  imports: [MatDialogModule, MatButtonModule, MatProgressBarModule, LevelPill, VitalsChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './patient-vitals-dialog.html',
  styleUrl: './patient-vitals-dialog.scss',
})
export class PatientVitalsDialog {
  protected readonly ticket = inject<Ticket>(MAT_DIALOG_DATA);
  private readonly api = inject(TicketsApi);

  protected readonly windows = WINDOWS;
  protected readonly minutes = signal<number>(120);
  protected readonly history = signal<VitalsHistory | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly showTable = signal(false);
  protected readonly alertLabels = ALERT_KIND_LABELS;
  protected readonly hhmm = hhmm;

  /** Tabla: lo más reciente arriba, como máximo 60 filas. */
  protected readonly rows = computed(() => [...(this.history()?.points ?? [])].reverse().slice(0, 60));

  constructor() {
    const destroyRef = inject(DestroyRef);
    const realtime = inject(RealtimeService);
    merge(
      // Una lectura nueva de este turno refresca la curva (como mucho cada 5 s).
      realtime.on<TelemetryReadingEvent>(REALTIME_EVENTS.TELEMETRY_READING).pipe(
        filter((e) => e.ticketId === this.ticket.id),
        throttleTime(5000, undefined, { leading: true, trailing: true }),
      ),
      interval(30_000),
      realtime.ready$,
    )
      .pipe(
        startWith(null),
        switchMap(() => this.load()),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();
  }

  protected setWindow(minutes: number): void {
    this.minutes.set(minutes);
    this.history.set(null);
    this.load().subscribe();
  }

  protected fmt(v: number | null, decimals: number): string {
    return v === null ? '—' : v.toFixed(decimals);
  }

  private load() {
    return this.api.vitals(this.ticket.id, this.minutes()).pipe(
      tap((h) => {
        this.history.set(h);
        this.error.set(null);
      }),
      catchError((err: unknown) => {
        this.error.set(apiErrorMessage(err, 'No se pudo cargar la curva'));
        return of(null);
      }),
    );
  }
}
