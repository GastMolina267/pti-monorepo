import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';

/** Período del "latido" de luz: el mismo de una lectura de la pulsera (3 s). */
export const PULSE_MS = 3000;
/** Duración de la onda de un latido. */
export const RIPPLE_MS = 1800;

/** Brillo de un punto por cercanía a la luz (0 lejos, 1 justo debajo), con caída suave. */
export function glowIntensity(dist: number, radius: number): number {
  const k = Math.max(0, 1 - dist / radius);
  return k * k;
}

/** Brillo de un punto por la onda de un latido: máximo sobre el frente de la onda. */
export function waveIntensity(distToOrigin: number, waveRadius: number, life: number, band = 90): number {
  return Math.max(0, 1 - Math.abs(distToOrigin - waveRadius) / band) * Math.max(0, life);
}

interface Dot {
  x: number;
  y: number;
}

/**
 * Fondo vivo de la landing: una grilla de puntos como la de un monitor de signos vitales,
 * una luz que sigue al cursor (o deriva sola en pantallas táctiles) y un latido de luz
 * cada 3 s que recorre la grilla. Detrás de todo el contenido, sin capturar eventos.
 *
 * - Movimiento reducido: un único cuadro estático.
 * - Pestaña oculta: no dibuja.
 * - Colores leídos de los tokens `--vt-*` (cambian con el tema).
 */
@Component({
  selector: 'vt-ambient-light',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="amb" aria-hidden="true" #layer>
      <div class="amb__aurora">
        <i class="amb__blob amb__blob--1"></i>
        <i class="amb__blob amb__blob--2"></i>
        <i class="amb__blob amb__blob--3"></i>
      </div>
      <canvas class="amb__canvas" #canvas></canvas>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
    }
    .amb {
      position: absolute;
      inset: 0;
      --px: 0;
      --py: 0;
    }
    .amb__aurora {
      position: absolute;
      inset: -10%;
      transform: translate3d(calc(var(--px) * -24px), calc(var(--py) * -24px), 0);
      opacity: 0.55;
    }
    :host-context([data-theme='dark']) .amb__aurora {
      opacity: 0.9;
    }
    .amb__blob {
      position: absolute;
      width: 46vmax;
      height: 46vmax;
      border-radius: 50%;
      // Sin filter: blur (caro sin GPU): el degradé radial ya es suave.
    }
    .amb__blob--1 {
      left: -6%;
      top: -12%;
      background: radial-gradient(
        circle,
        color-mix(in srgb, var(--vt-primary) 28%, transparent),
        transparent 70%
      );
      animation: amb-drift-1 26s ease-in-out infinite alternate;
    }
    .amb__blob--2 {
      right: -10%;
      top: 18%;
      background: radial-gradient(
        circle,
        color-mix(in srgb, var(--vt-secondary) 24%, transparent),
        transparent 70%
      );
      animation: amb-drift-2 32s ease-in-out infinite alternate;
    }
    .amb__blob--3 {
      left: 24%;
      bottom: -20%;
      background: radial-gradient(
        circle,
        color-mix(in srgb, var(--vt-success) 20%, transparent),
        transparent 70%
      );
      animation: amb-drift-3 38s ease-in-out infinite alternate;
    }
    @keyframes amb-drift-1 {
      to {
        transform: translate(16vw, 12vh) scale(1.15);
      }
    }
    @keyframes amb-drift-2 {
      to {
        transform: translate(-18vw, 16vh) scale(0.9);
      }
    }
    @keyframes amb-drift-3 {
      to {
        transform: translate(12vw, -18vh) scale(1.2);
      }
    }
    .amb__canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
  `,
})
export class AmbientLight {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly layer = viewChild.required<ElementRef<HTMLElement>>('layer');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const stop = this.start();
      if (stop) destroyRef.onDestroy(stop);
    });
  }

  private start(): (() => void) | undefined {
    // Sin IntersectionObserver no es un navegador real (jsdom): no se dibuja nada.
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    const canvas = this.canvas().nativeElement;
    const layer = this.layer().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    // Sin mouse la luz deriva sola y pasa por detrás del texto: va a media intensidad.
    const strength = finePointer ? 1 : 0.45;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let dots: Dot[] = [];
    let base: HTMLCanvasElement | undefined;
    let colors = { dot: '', glow: '', wave: '', dark: false };

    const pointer = { x: 0, y: 0, active: false };
    const light = { x: 0, y: 0 };
    const ripples: { x: number; y: number; t0: number }[] = [];
    let lastPulse = 0;
    let lastFrame = 0;
    let raf = 0;

    const readColors = () => {
      const css = getComputedStyle(document.documentElement);
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      colors = {
        dot: css.getPropertyValue('--vt-primary').trim(),
        glow: css.getPropertyValue(dark ? '--vt-primary-light' : '--vt-primary').trim(),
        wave: css.getPropertyValue('--vt-live').trim(),
        dark,
      };
    };

    // La grilla de fondo se dibuja una sola vez en un lienzo aparte y se copia en cada cuadro.
    const buildBase = () => {
      const spacing = w < 640 ? 30 : 26;
      dots = [];
      for (let y = spacing / 2; y < h; y += spacing) {
        for (let x = spacing / 2; x < w; x += spacing) dots.push({ x, y });
      }
      base = document.createElement('canvas');
      base.width = Math.round(w * dpr);
      base.height = Math.round(h * dpr);
      const b = base.getContext('2d');
      if (!b) return;
      b.scale(dpr, dpr);
      b.fillStyle = colors.dot;
      b.globalAlpha = colors.dark ? 0.2 : 0.15;
      for (const d of dots) {
        b.beginPath();
        b.arc(d.x, d.y, 1.2, 0, Math.PI * 2);
        b.fill();
      }
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      if (!pointer.active) {
        light.x = w * 0.72;
        light.y = h * 0.32;
      }
      buildBase();
      draw(performance.now());
    };

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (base) ctx.drawImage(base, 0, 0, w, h);

      // Luz principal: un halo suave alrededor del cursor.
      const radius = Math.max(320, Math.min(w, h) * 0.55);
      const g = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, radius);
      g.addColorStop(0, colors.glow);
      g.addColorStop(1, 'transparent');
      ctx.globalAlpha = (colors.dark ? 0.26 : 0.16) * strength;
      ctx.fillStyle = g;
      ctx.fillRect(light.x - radius, light.y - radius, radius * 2, radius * 2);

      // Anillo del latido: un trazo de luz que se expande y se apaga.
      for (const rp of ripples) {
        const age = (t - rp.t0) / RIPPLE_MS;
        if (age <= 0 || age >= 1) continue;
        const r = age * Math.hypot(w, h) * 0.6;
        ctx.globalAlpha = (1 - age) * (colors.dark ? 0.35 : 0.22) * strength;
        ctx.strokeStyle = colors.wave;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Puntos encendidos por la luz o por la onda del latido.
      const maxR = Math.hypot(w, h) * 0.6;
      const live = ripples
        .map((rp) => {
          const age = (t - rp.t0) / RIPPLE_MS;
          return { x: rp.x, y: rp.y, r: age * maxR, life: 1 - age };
        })
        .filter((rp) => rp.life > 0);
      const near = 260;
      for (const d of dots) {
        const dx = d.x - light.x;
        const dy = d.y - light.y;
        const dist = Math.hypot(dx, dy);
        let wave = 0;
        for (const rp of live) {
          wave = Math.max(wave, waveIntensity(Math.hypot(d.x - rp.x, d.y - rp.y), rp.r, rp.life));
        }
        const glow = glowIntensity(dist, near);
        const boost = Math.min(1, glow + wave) * strength;
        if (boost < 0.02) continue;
        ctx.globalAlpha = Math.min(0.95, (colors.dark ? 0.24 : 0.18) + boost * 0.8);
        ctx.fillStyle = wave > glow ? colors.wave : colors.glow;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 1.2 + boost * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Profundidad: las auroras se corren un poco al revés que la luz.
      layer.style.setProperty('--px', ((light.x / w) * 2 - 1).toFixed(3));
      layer.style.setProperty('--py', ((light.y / h) * 2 - 1).toFixed(3));
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      // En pantallas táctiles alcanza con 30 cuadros por segundo.
      if (!finePointer && t - lastFrame < 33) return;
      lastFrame = t;

      if (pointer.active) {
        light.x += (pointer.x - light.x) * 0.12;
        light.y += (pointer.y - light.y) * 0.12;
      } else {
        // Sin cursor, la luz deriva despacio por la parte alta de la pantalla.
        const tx = w * (0.5 + 0.34 * Math.sin(t / 5200));
        const ty = h * (0.34 + 0.16 * Math.sin(t / 3700));
        light.x += (tx - light.x) * 0.02;
        light.y += (ty - light.y) * 0.02;
      }

      if (t - lastPulse > PULSE_MS) {
        lastPulse = t;
        ripples.push({ x: light.x, y: light.y, t0: t });
      }
      while (ripples.length && t - ripples[0].t0 > RIPPLE_MS) ripples.shift();
      draw(t);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };
    const onLeave = () => (pointer.active = false);
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (document.visibilityState === 'visible' && !reduced) raf = requestAnimationFrame(frame);
    };
    const themeObserver = new MutationObserver(() => {
      readColors();
      buildBase();
      draw(performance.now());
    });

    readColors();
    resize();
    window.addEventListener('resize', resize, { passive: true });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (!reduced) {
      window.addEventListener('pointermove', onMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
      document.addEventListener('visibilitychange', onVisibility);
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      themeObserver.disconnect();
    };
  }
}
