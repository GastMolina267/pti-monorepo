import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideActivity,
  LucideBellRing,
  LucideListOrdered,
  LucideLogOut,
  LucideVolume2,
  LucideVolumeX,
  LucideWatch,
} from '@lucide/angular';
import { Logo, ThemeToggle } from '@vitalia/ui';
import { AlertOverlay } from '../../features/alerts/alert-overlay';
import { HealthApi } from '../api/health.api';
import { AuthService } from '../auth/auth.service';
import { AlertsStore } from '../live/alerts.store';
import { QueueStore } from '../live/queue.store';
import { WearablesStore } from '../live/wearables.store';
import { RealtimeService } from '../realtime/realtime.service';
import { AlarmService } from '../sound/alarm.service';

const CONNECTION_LABELS = { live: 'En vivo', connecting: 'Reconectando…', offline: 'Sin conexión' } as const;

/**
 * Layout del personal: navegación, estado de la conexión en vivo, sonido, usuario y el aviso
 * de alertas. Mientras existe (hay sesión), mantiene vivos los stores de fila, pulseras y alertas.
 */
@Component({
  selector: 'vt-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    Logo,
    ThemeToggle,
    AlertOverlay,
    LucideActivity,
    LucideBellRing,
    LucideListOrdered,
    LucideLogOut,
    LucideVolume2,
    LucideVolumeX,
    LucideWatch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly realtime = inject(RealtimeService);
  protected readonly alarm = inject(AlarmService);
  protected readonly alerts = inject(AlertsStore);
  protected readonly health = inject(HealthApi).health;

  protected readonly connectionLabel = computed(() => CONNECTION_LABELS[this.realtime.state()]);
  protected readonly initials = computed(() =>
    (this.auth.user()?.fullName ?? '')
      .replace(/^(Dra?\.|Lic\.)\s*/i, '')
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join(''),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    inject(QueueStore).start(destroyRef);
    inject(WearablesStore).start(destroyRef);
    this.alerts.start(destroyRef);
  }
}
