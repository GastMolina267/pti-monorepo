import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { animate, type JSAnimation } from 'animejs';
import { Motion } from '../../core/motion';
import { MARKET, formatInt } from './revenue-model';

/** Permutación determinística (mulberry32): los puntos quedan "esparcidos" como en un mapa. */
export function shuffledIndices(n: number, seed = 2026): Uint16Array {
  const out = new Uint16Array(n);
  for (let i = 0; i < n; i++) out[i] = i;
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Un punto por cada establecimiento con internación de la Argentina (REFES 2023).
 * Los públicos en teal, los privados en celeste; los `highlighted` se encienden en
 * verde "en vivo" y la calculadora los mueve. Se dibuja en canvas (6.729 puntos).
 */
@Component({
  selector: 'vt-market-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="field">
      <canvas #canvas role="img" [attr.aria-label]="label()"></canvas>
      <figcaption class="field__legend">
        <span><i class="dot dot--public"></i>{{ fmt(market.publicEstablishments) }} públicos</span>
        <span><i class="dot dot--private"></i>{{ fmt(market.privateEstablishments) }} privados</span>
        @if (highlighted() > 0) {
          <span><i class="dot dot--live"></i>{{ fmt(highlighted()) }} en el escenario</span>
        }
      </figcaption>
    </figure>
  `,
  styles: `
    :host {
      display: block;
    }
    .field {
      margin: 0;
      display: grid;
      gap: var(--lp-s-4);
    }
    canvas {
      display: block;
      width: 100%;
    }
    .field__legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--lp-s-2) var(--lp-s-5);
      font-size: var(--lp-text-sm);
      line-height: 20px;
      font-weight: 700;
      color: var(--vt-muted);
    }
    .field__legend span {
      display: inline-flex;
      align-items: center;
      gap: var(--lp-s-2);
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .dot--public {
      background: var(--vt-primary);
    }
    .dot--private {
      background: var(--vt-secondary);
      opacity: 0.5;
    }
    .dot--live {
      background: var(--vt-live);
      box-shadow: 0 0 0 3px var(--vt-surface-2);
    }
  `,
})
export class MarketField {
  /** Cantidad de establecimientos a resaltar (los "clientes" del escenario). */
  readonly highlighted = input(0);

  protected readonly market = MARKET;
  protected readonly fmt = formatInt;
  protected readonly label = computed(
    () =>
      `${formatInt(MARKET.establishments)} establecimientos con internación en la Argentina: ` +
      `${formatInt(MARKET.publicEstablishments)} públicos y ${formatInt(MARKET.privateEstablishments)} privados.` +
      (this.highlighted() > 0 ? ` Resaltados: ${formatInt(this.highlighted())} del escenario.` : ''),
  );

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly motion = inject(Motion);
  private readonly order = shuffledIndices(MARKET.establishments);
  /** Rango de cada punto en la permutación: los primeros N se encienden. */
  private readonly rank = (() => {
    const r = new Uint16Array(MARKET.establishments);
    this.order.forEach((dot, i) => (r[dot] = i));
    return r;
  })();
  /** Tipo de cada punto: otra permutación para que públicos y privados se mezclen. */
  private readonly isPublic = (() => {
    const p = new Uint8Array(MARKET.establishments);
    shuffledIndices(MARKET.establishments, 1743)
      .slice(0, MARKET.publicEstablishments)
      .forEach((i) => (p[i] = 1));
    return p;
  })();
  private readonly lit = { value: 0 };
  private tween?: JSAnimation;
  private ready = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      // Sin ResizeObserver (jsdom, navegadores viejos) no hay canvas que medir.
      if (typeof ResizeObserver === 'undefined' || !this.canvas().nativeElement.getContext) return;
      this.ready = true;
      this.lit.value = this.highlighted();
      const ro = new ResizeObserver(() => this.draw());
      ro.observe(this.canvas().nativeElement);
      const mo = new MutationObserver(() => this.draw());
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      destroyRef.onDestroy(() => {
        ro.disconnect();
        mo.disconnect();
        this.tween?.revert();
      });
      this.draw();
    });

    effect(() => {
      const target = this.highlighted();
      if (!this.ready) return;
      this.tween?.pause();
      if (!this.motion.enabled) {
        this.lit.value = target;
        this.draw();
        return;
      }
      // Responde al cambio de la calculadora: los puntos se encienden de a poco.
      this.tween = animate(this.lit, {
        value: target,
        duration: 700,
        ease: 'out(3)',
        modifier: Math.round,
        onUpdate: () => this.draw(),
      });
    });
  }

  private draw(): void {
    const el = this.canvas().nativeElement;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const width = el.clientWidth;
    if (!width) return;
    const cell = width < 420 ? 4 : width < 640 ? 6 : 7;
    const cols = Math.floor(width / cell);
    const rows = Math.ceil(MARKET.establishments / cols);
    const height = rows * cell;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (el.width !== Math.round(width * dpr) || el.height !== Math.round(height * dpr)) {
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      el.style.height = `${height}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const css = getComputedStyle(el);
    const colors = {
      public: css.getPropertyValue('--vt-primary').trim(),
      private: css.getPropertyValue('--vt-secondary').trim(),
      live: css.getPropertyValue('--vt-live').trim(),
    };
    const r = cell * 0.32;
    const lit = this.lit.value;
    for (let i = 0; i < MARKET.establishments; i++) {
      const x = (i % cols) * cell + cell / 2;
      const y = Math.floor(i / cols) * cell + cell / 2;
      const on = this.rank[i] < lit;
      ctx.globalAlpha = on ? 1 : this.isPublic[i] ? 0.5 : 0.22;
      ctx.fillStyle = on ? colors.live : this.isPublic[i] ? colors.public : colors.private;
      ctx.beginPath();
      ctx.arc(x, y, on ? r * 1.6 : r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
