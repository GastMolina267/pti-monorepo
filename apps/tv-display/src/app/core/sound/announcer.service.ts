import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { TicketCalledEvent } from '@vitalia/contracts';

/** `A-024` + `Consultorio 4` → `Turno A 24. Consultorio 4.` (más natural que deletrear ceros). */
export function spokenCall(e: Pick<TicketCalledEvent, 'ticketCode' | 'consultingRoom'>): string {
  const m = /^([A-Z]+)-0*(\d+)$/.exec(e.ticketCode);
  const code = m ? `${m[1]} ${m[2]}` : e.ticketCode;
  return `Turno ${code}. ${e.consultingRoom}.`;
}

/**
 * Aviso del llamado: campanita con Web Audio y voz con `speechSynthesis` (offline, voces del
 * sistema). Los navegadores bloquean el audio hasta un toque en la pantalla: en kiosco,
 * Chrome con `--autoplay-policy=no-user-gesture-required` lo evita (ver AGENTS.md).
 */
@Injectable({ providedIn: 'root' })
export class AnnouncerService {
  private ctx: AudioContext | null = null;
  /** El audio sigue bloqueado: la pantalla muestra "Tocá para activar el sonido". */
  readonly needsUnlock = signal(globalThis.AudioContext !== undefined);

  constructor() {
    inject(DestroyRef).onDestroy(() => void this.ctx?.close());
    this.tryResume();
  }

  /** Dentro de un gesto del usuario (toque o click). */
  unlock(): void {
    this.tryResume();
    // Algunas plataformas también exigen un gesto para la primera locución.
    globalThis.speechSynthesis?.speak(new SpeechSynthesisUtterance(''));
  }

  announce(e: TicketCalledEvent): void {
    this.chime();
    const synth = globalThis.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(spokenCall(e));
    u.lang = 'es-AR';
    u.rate = 0.92;
    u.voice = synth.getVoices().find((v) => v.lang.startsWith('es')) ?? null;
    // Después de la campanita.
    setTimeout(() => synth.speak(u), 900);
  }

  private tryResume(): void {
    const Ctx = globalThis.AudioContext;
    if (!Ctx) return;
    this.ctx ??= new Ctx();
    void this.ctx.resume().then(() => this.needsUnlock.set(this.ctx?.state !== 'running'));
  }

  /** Tres notas ascendentes (do-mi-sol), suaves. */
  private chime(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') {
      this.needsUnlock.set(ctx !== null);
      return;
    }
    const t0 = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t0 + i * 0.22;
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.65);
    });
  }
}
