import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LucideCircleCheck } from '@lucide/angular';
import { ALERT_KIND_LABELS, ALERT_STATUS_LABELS, REALTIME_EVENTS, type Alert } from '@vitalia/contracts';
import { catchError, debounceTime, merge, of, startWith, switchMap, tap } from 'rxjs';
import { AlertsApi } from '../../core/api/alerts.api';
import { apiErrorMessage } from '../../core/api/api-error';
import { AlertsStore } from '../../core/live/alerts.store';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { ago, ClockService, hhmm } from '../../core/time/clock.service';
import { AlertKindIcon } from '../../shared/alert-kind-icon';

type Tab = 'active' | 'history';

/** Alertas activas (en vivo) e historial (últimas 100) con quién y cuándo las reconoció. */
@Component({
  selector: 'vt-alerts',
  imports: [MatButtonModule, MatProgressBarModule, AlertKindIcon, LucideCircleCheck],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './alerts.html',
  styleUrl: './alerts.scss',
})
export class Alerts {
  protected readonly store = inject(AlertsStore);
  private readonly api = inject(AlertsApi);
  private readonly realtime = inject(RealtimeService);
  private readonly clock = inject(ClockService);
  private readonly snack = inject(MatSnackBar);

  protected readonly tab = signal<Tab>('active');
  protected readonly history = signal<Alert[] | null>(null);
  protected readonly kindLabels = ALERT_KIND_LABELS;
  protected readonly statusLabels = ALERT_STATUS_LABELS;
  protected readonly hhmm = hhmm;

  constructor() {
    merge(
      this.realtime.on(REALTIME_EVENTS.ALERT_EMERGENCY),
      this.realtime.on(REALTIME_EVENTS.ALERT_ACKNOWLEDGED),
      this.realtime.ready$,
    )
      .pipe(
        // La alerta se guarda después de emitirse: dar un margen antes de pedir el historial.
        debounceTime(800),
        startWith(null),
        switchMap(() => this.api.list(false).pipe(catchError(() => of(null)))),
        tap((list) => list && this.history.set(list)),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe();
  }

  protected ago(iso: string | null): string {
    return ago(iso, this.clock.now());
  }

  protected async acknowledge(a: Alert): Promise<void> {
    try {
      await this.store.acknowledge(a);
      this.snack.open(`Alerta reconocida: ${ALERT_KIND_LABELS[a.kind]}`, 'OK', { duration: 3000 });
    } catch (err) {
      this.snack.open(apiErrorMessage(err, 'No se pudo reconocer la alerta'), 'Cerrar', { duration: 5000 });
    }
  }
}
