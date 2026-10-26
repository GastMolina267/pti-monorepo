import { DestroyRef, ElementRef, afterNextRender, inject, signal } from '@angular/core';

/**
 * Reloj de los widgets "en vivo" de la landing: un contador que avanza cada `periodMs`
 * solo mientras el widget está en pantalla y la pestaña visible. No corre en jsdom ni
 * sin `IntersectionObserver`, así los tests ven siempre el estado inicial.
 * Llamalo desde el constructor del componente (usa el contexto de inyección).
 */
export function liveTicker(periodMs: number, opts: { startPaused?: boolean } = {}) {
  const tick = signal(0);
  const paused = signal(!!opts.startPaused);
  const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  const destroyRef = inject(DestroyRef);
  let visible = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  const sync = () => {
    const run = visible && !paused() && document.visibilityState === 'visible';
    if (run && !timer) timer = setInterval(() => tick.update((t) => t + 1), periodMs);
    if (!run && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };

  afterNextRender(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      sync();
    });
    io.observe(host);
    document.addEventListener('visibilitychange', sync);
    destroyRef.onDestroy(() => {
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      clearInterval(timer);
    });
  });

  return {
    tick: tick.asReadonly(),
    paused: paused.asReadonly(),
    toggle() {
      paused.update((p) => !p);
      sync();
    },
  };
}

/** `true` si la persona pidió menos movimiento (los widgets arrancan en pausa). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
