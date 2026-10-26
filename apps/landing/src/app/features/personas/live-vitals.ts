import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { LucideBell, LucidePause, LucidePlay } from '@lucide/angular';
import { liveTicker, prefersReducedMotion } from '../../shared/live-feed';
import { Spotlight } from '../../shared/spotlight';

/** Lecturas simuladas de la pulsera (una cada 3 s, como el firmware). Datos de ejemplo. */
export const SAMPLE_READINGS = [
  { hr: 78, spo2: 98, temp: 36.6 },
  { hr: 80, spo2: 98, temp: 36.6 },
  { hr: 79, spo2: 97, temp: 36.7 },
  { hr: 76, spo2: 98, temp: 36.6 },
  { hr: 77, spo2: 99, temp: 36.5 },
  { hr: 81, spo2: 98, temp: 36.6 },
  { hr: 83, spo2: 97, temp: 36.7 },
  { hr: 79, spo2: 98, temp: 36.6 },
] as const;

/** Personas antes según la lectura: baja de a una cada dos lecturas y después te llaman. */
export function peopleAhead(tick: number): number {
  return Math.max(0, 3 - Math.floor((tick % 8) / 2));
}

/** Un latido de ECG en un tramo de 200 unidades, repetido 6 veces (dos vueltas). */
const BEAT = 'h 70 l 10 -6 l 8 6 h 14 l 6 10 l 10 -64 l 10 76 l 8 -22 h 18 l 12 -10 l 12 10 h 22';
const TRACE = `M 0 70 ${Array.from({ length: 6 }, () => BEAT).join(' ')}`;

/**
 * Widget del hero: lo que el personal ve de una pulsera (traza, lecturas cada 3 s)
 * y lo que la persona ve de su turno, que avanza hasta el llamado. Todo simulado.
 */
@Component({
  selector: 'vt-live-vitals',
  imports: [Spotlight, LucideBell, LucidePause, LucidePlay],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-vitals.html',
  styleUrl: './live-vitals.scss',
})
export class LiveVitals {
  private readonly feed = liveTicker(3000, { startPaused: prefersReducedMotion() });
  protected readonly paused = this.feed.paused;
  protected readonly trace = TRACE;
  protected readonly reading = computed(() => SAMPLE_READINGS[this.feed.tick() % SAMPLE_READINGS.length]);
  protected readonly ahead = computed(() => peopleAhead(this.feed.tick()));
  protected readonly called = computed(() => this.ahead() === 0);
  /** Clave que cambia con cada lectura: reinicia la barra de "próxima lectura". */
  protected readonly cycle = computed(() => [this.feed.tick()]);
  protected readonly seats = [0, 1, 2];

  protected toggle(): void {
    this.feed.toggle();
  }

  protected temp(v: number): string {
    return v.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
}
