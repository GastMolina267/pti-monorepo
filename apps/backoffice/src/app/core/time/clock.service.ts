import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/** Reloj compartido (cada 5 s) para "hace X min", espera en la fila y pulseras en línea. */
@Injectable({ providedIn: 'root' })
export class ClockService {
  readonly now = signal(Date.now());

  constructor() {
    const id = setInterval(() => this.now.set(Date.now()), 5000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
}

/** `"hace 3 min"`, `"hace 40 s"`, `"hace 2 h"`. */
export function ago(iso: string | null | undefined, now: number): string {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 5) return 'recién';
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.round(m / 60)} h`;
}

/** Minutos enteros transcurridos. */
export function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}

/** `14:05` en hora local (es-AR, 24 h). */
export function hhmm(iso: string | null | undefined): string {
  return iso
    ? new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '—';
}
