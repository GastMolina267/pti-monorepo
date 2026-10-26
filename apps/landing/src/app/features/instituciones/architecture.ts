import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  LucideCloud,
  LucideCloudOff,
  LucideDatabase,
  LucideMonitor,
  LucideRadio,
  LucideRouter,
  LucideServer,
  LucideSmartphone,
  LucideTv,
  LucideWatch,
} from '@lucide/angular';
import { Spotlight } from '../../shared/spotlight';

/** VLAN del router gestionado (docs/01-arquitectura.md). */
export const VLANS = [
  { id: 10, name: 'Pulseras (IoMT)' },
  { id: 20, name: 'Pacientes + portal' },
  { id: 30, name: 'Personal' },
  { id: 40, name: 'TV y kioscos' },
] as const;

/**
 * Arquitectura por capas (Edge → red → Fog → nube) con datos que circulan, y una
 * simulación de corte de internet: la sala sigue funcionando y los cambios para la
 * nube se encolan hasta que vuelve la conexión (outbox, ADR 0018).
 */
@Component({
  selector: 'vt-architecture',
  imports: [
    Spotlight,
    LucideWatch,
    LucideSmartphone,
    LucideTv,
    LucideRouter,
    LucideServer,
    LucideDatabase,
    LucideRadio,
    LucideMonitor,
    LucideCloud,
    LucideCloudOff,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './architecture.html',
  styleUrl: './architecture.scss',
})
export class Architecture {
  protected readonly vlans = VLANS;
  protected readonly offline = signal(false);
  /** Cambios de turnos y alertas esperando para subir a la nube (simulados). */
  protected readonly pending = signal(0);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  protected toggle(): void {
    clearInterval(this.timer);
    const goingOffline = !this.offline();
    this.offline.set(goingOffline);
    if (goingOffline) {
      // Mientras no hay internet, la sala sigue generando cambios que quedan en cola.
      this.timer = setInterval(() => this.pending.update((n) => Math.min(n + 1, 999)), 1200);
    } else {
      // Al volver la conexión, la cola se vacía en orden.
      this.timer = setInterval(() => {
        this.pending.update((n) => Math.max(n - 1, 0));
        if (this.pending() === 0) clearInterval(this.timer);
      }, 160);
    }
  }
}
