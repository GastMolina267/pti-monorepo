import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { LucideSiren, LucideVolume2 } from '@lucide/angular';
import { ALERT_KIND_LABELS, type Alert } from '@vitalia/contracts';
import { apiErrorMessage } from '../../core/api/api-error';
import { AlertsStore } from '../../core/live/alerts.store';
import { AlarmService } from '../../core/sound/alarm.service';
import { ago, ClockService, hhmm } from '../../core/time/clock.service';
import { AlertKindIcon } from '../../shared/alert-kind-icon';

/**
 * Aviso de alerta crítica (RF-O4): pantalla roja intermitente + alarma hasta que alguien la
 * reconoce o la minimiza. Una alerta nueva lo vuelve a abrir.
 */
@Component({
  selector: 'vt-alert-overlay',
  imports: [A11yModule, MatButtonModule, AlertKindIcon, LucideSiren, LucideVolume2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './alert-overlay.html',
  styleUrl: './alert-overlay.scss',
})
export class AlertOverlay {
  protected readonly store = inject(AlertsStore);
  protected readonly alarm = inject(AlarmService);
  private readonly clock = inject(ClockService);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);

  protected readonly kindLabels = ALERT_KIND_LABELS;
  protected readonly main = computed(() => this.store.pending()[0] ?? null);
  protected readonly others = computed(() => this.store.pending().slice(1));
  protected readonly hhmm = hhmm;

  protected ago(a: Alert): string {
    return ago(a.detectedAt, this.clock.now());
  }

  protected async acknowledge(a: Alert): Promise<void> {
    this.alarm.unlock();
    try {
      await this.store.acknowledge(a);
    } catch (err) {
      this.snack.open(apiErrorMessage(err, 'No se pudo reconocer la alerta'), 'Cerrar', { duration: 5000 });
    }
  }

  protected minimize(): void {
    this.store.minimizeAll();
  }

  protected viewAll(): void {
    this.store.minimizeAll();
    void this.router.navigate(['/alertas']);
  }
}
