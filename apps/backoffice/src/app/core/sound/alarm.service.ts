import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';

const MUTED_KEY = 'vitalia_alarm_muted';
const PERIOD_MS = 1400;

/**
 * Alarma sonora de las alertas críticas con Web Audio (sin archivos ni servicios externos).
 * Los navegadores bloquean el audio hasta una interacción del usuario: `unlock()` se llama
 * en un click (login, botón "Activar sonido"); mientras tanto `needsUnlock` avisa en la UI.
 */
@Injectable({ providedIn: 'root' })
export class AlarmService {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;

  readonly muted = signal(this.readMuted());
  /** Hay alarma sonando (o que debería sonar). */
  readonly active = signal(false);
  /** El navegador todavía no dejó reproducir audio. */
  readonly needsUnlock = signal(false);

  constructor() {
    effect(() => {
      const ring = this.active() && !this.muted();
      if (ring) this.start();
      else this.stop();
    });
    effect(() => {
      try {
        localStorage.setItem(MUTED_KEY, String(this.muted()));
      } catch {
        /* sin storage */
      }
    });
    // Si el navegador ya permite audio (kiosco o interacción previa), queda listo sin clicks.
    this.unlock();
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      void this.ctx?.close();
    });
  }

  /** Llamar dentro de un evento de usuario (click). */
  unlock(): void {
    const Ctx = globalThis.AudioContext;
    if (!Ctx) return;
    this.ctx ??= new Ctx();
    void this.ctx.resume().then(() => this.needsUnlock.set(false));
  }

  toggleMute(): void {
    this.unlock();
    this.muted.update((m) => !m);
  }

  private start(): void {
    if (this.timer) return;
    this.beep();
    this.timer = setInterval(() => this.beep(), PERIOD_MS);
  }

  private stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Dos tonos cortos (880 → 660 Hz), como un monitor de signos vitales. */
  private beep(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') {
      this.needsUnlock.set(globalThis.AudioContext !== undefined);
      return;
    }
    const t0 = ctx.currentTime;
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t0 + i * 0.22;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }

  private readMuted(): boolean {
    try {
      return localStorage.getItem(MUTED_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
