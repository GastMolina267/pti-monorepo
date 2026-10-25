import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LucidePlus, LucideRadio, LucideUnlink, LucideWrench } from '@lucide/angular';
import { ROLES_CAN_MANAGE_WEARABLES, WEARABLE_STATUS_LABELS, type Wearable } from '@vitalia/contracts';
import { apiErrorMessage } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { WearablesStore, type WearableView } from '../../core/live/wearables.store';
import { ago, ClockService } from '../../core/time/clock.service';
import { LevelPill } from '../../shared/level-pill';
import { Vitals } from '../../shared/vitals';
import { AssignWearableDialog } from './assign-wearable-dialog';
import { CreateWearableDialog } from './create-wearable-dialog';

/** Pulseras IoMT: conexión, turno asignado y última lectura en vivo. */
@Component({
  selector: 'vt-wearables',
  imports: [
    MatButtonModule,
    MatProgressBarModule,
    LevelPill,
    Vitals,
    LucidePlus,
    LucideRadio,
    LucideUnlink,
    LucideWrench,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wearables.html',
  styleUrl: './wearables.scss',
})
export class Wearables {
  protected readonly store = inject(WearablesStore);
  private readonly clock = inject(ClockService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  protected readonly canManage = inject(AuthService).can(ROLES_CAN_MANAGE_WEARABLES);
  protected readonly statusLabels = WEARABLE_STATUS_LABELS;

  protected pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  protected seen(w: WearableView): string {
    if (!w.lastSeenAt) return 'Nunca se conectó';
    return w.online
      ? `En línea · ${ago(w.lastSeenAt, this.clock.now())}`
      : `Sin señal · ${ago(w.lastSeenAt, this.clock.now())}`;
  }

  protected create(): void {
    this.dialog
      .open<CreateWearableDialog, void, Wearable>(CreateWearableDialog, { width: '460px', maxWidth: '94vw' })
      .afterClosed()
      .subscribe((w) => w && this.snack.open(`Pulsera ${w.code} dada de alta`, 'OK', { duration: 3000 }));
  }

  protected assign(w: Wearable): void {
    this.dialog
      .open<AssignWearableDialog, Wearable, Wearable>(AssignWearableDialog, {
        data: w,
        width: '560px',
        maxWidth: '94vw',
      })
      .afterClosed()
      .subscribe(
        (res) =>
          res?.ticket &&
          this.snack.open(`Pulsera ${res.code} asignada a ${res.ticket.code}`, 'OK', { duration: 3000 }),
      );
  }

  /** Mantenimiento (correa rota, batería, etc.): la pulsera no se puede asignar hasta volver. */
  protected async toggleMaintenance(w: Wearable): Promise<void> {
    const status = w.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    try {
      await this.store.update(w, { status });
      this.snack.open(
        status === 'MAINTENANCE' ? `Pulsera ${w.code} en mantenimiento` : `Pulsera ${w.code} disponible`,
        'OK',
        { duration: 3000 },
      );
    } catch (err) {
      this.snack.open(apiErrorMessage(err, 'No se pudo cambiar el estado'), 'Cerrar', { duration: 5000 });
    }
  }

  protected async release(w: Wearable): Promise<void> {
    try {
      await this.store.release(w);
      this.snack.open(`Pulsera ${w.code} liberada`, 'OK', { duration: 3000 });
    } catch (err) {
      this.snack.open(apiErrorMessage(err, 'No se pudo liberar la pulsera'), 'Cerrar', { duration: 5000 });
    }
  }
}
