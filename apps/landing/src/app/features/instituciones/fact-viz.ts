import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { animate, onScroll, stagger, svg } from 'animejs';
import { Motion } from '../../core/motion';

export type FactViz =
  | { kind: 'split'; parts: readonly { label: string; value: number }[] }
  | { kind: 'share'; value: number; label: string; rest: string }
  | {
      kind: 'growth';
      from: { year: number; value: number; label: string };
      to: { year: number; value: number; label: string };
      cagr: number;
    };

/** Curva de crecimiento compuesto entre dos años, normalizada a un lienzo de 300 × 120. */
export function growthPath(v: Extract<FactViz, { kind: 'growth' }>, w = 300, h = 120): string {
  const years = v.to.year - v.from.year;
  const max = v.from.value * Math.pow(1 + v.cagr, years);
  const pts = Array.from({ length: years + 1 }, (_, i) => {
    const value = v.from.value * Math.pow(1 + v.cagr, i);
    return [(i / years) * w, h - (value / max) * (h - 8)] as const;
  });
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}

/**
 * Gráfico chico al lado de cada cifra de mercado: reparto público/privado, proporción
 * de consultas no urgentes y crecimiento proyectado por la fuente. Se anima al entrar.
 */
@Component({
  selector: 'vt-fact-viz',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (viz().kind) {
      @case ('split') {
        @if (split(); as s) {
          <div class="bar" aria-hidden="true">
            @for (p of s.parts; track p.label; let i = $index) {
              <span [class]="'bar__seg bar__seg--' + i" [style.flex-grow]="p.value"></span>
            }
          </div>
          <ul class="legend">
            @for (p of s.parts; track p.label; let i = $index) {
              <li>
                <i [class]="'dot dot--' + i"></i>{{ p.label }} <strong>{{ pct(p.value / s.total) }}</strong>
              </li>
            }
          </ul>
        }
      }
      @case ('share') {
        @if (share(); as s) {
          <div class="bar" aria-hidden="true">
            <span class="bar__seg bar__seg--warn" [style.flex-grow]="s.value"></span>
            <span class="bar__seg bar__seg--rest" [style.flex-grow]="100 - s.value"></span>
          </div>
          <ul class="legend">
            <li><i class="dot dot--warn"></i>{{ s.label }}</li>
            <li><i class="dot dot--rest"></i>{{ s.rest }}</li>
          </ul>
        }
      }
      @case ('growth') {
        @if (growth(); as g) {
          <svg class="growth" viewBox="-6 -6 312 140" aria-hidden="true">
            <path class="growth__area" [attr.d]="path() + ' L 300 120 L 0 120 Z'" />
            <path class="growth__line" [attr.d]="path()" />
            <circle class="growth__end" cx="300" cy="8" r="6" />
          </svg>
          <div class="growth__axis">
            <span>{{ g.from.year }} · {{ g.from.label }}</span>
            <span>{{ g.to.year }} · {{ g.to.label }}</span>
          </div>
        }
      }
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--lp-s-3);
      align-content: center;
      min-width: 0;
    }
    .bar {
      display: flex;
      gap: 3px;
      height: 14px;
      border-radius: 999px;
      overflow: hidden;
    }
    .bar__seg {
      display: block;
      transform-origin: left;
    }
    .bar__seg--0 {
      background: var(--vt-primary);
    }
    .bar__seg--1 {
      background: var(--vt-secondary);
    }
    .bar__seg--warn {
      background: var(--vt-warning);
    }
    .bar__seg--rest {
      background: var(--vt-danger);
    }
    .legend {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: var(--lp-s-1) var(--lp-s-4);
      font-size: var(--lp-text-sm);
      line-height: 20px;
      color: var(--vt-muted);
    }
    .legend li {
      display: inline-flex;
      align-items: center;
      gap: var(--lp-s-2);
    }
    .legend strong {
      color: var(--vt-ink);
      font-variant-numeric: tabular-nums;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .dot--0 {
      background: var(--vt-primary);
    }
    .dot--1 {
      background: var(--vt-secondary);
    }
    .dot--warn {
      background: var(--vt-warning);
    }
    .dot--rest {
      background: var(--vt-danger);
    }
    .growth {
      width: 100%;
      height: auto;
      overflow: visible;
    }
    .growth__area {
      fill: var(--vt-surface-2);
    }
    .growth__line {
      fill: none;
      stroke: var(--vt-primary);
      stroke-width: 3;
      stroke-linecap: round;
    }
    .growth__end {
      fill: var(--vt-live);
      stroke: var(--vt-paper);
      stroke-width: 3;
    }
    .growth__axis {
      display: flex;
      justify-content: space-between;
      gap: var(--lp-s-3);
      font-size: var(--lp-text-xs);
      line-height: 16px;
      font-weight: 700;
      color: var(--vt-muted);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class FactVizView {
  readonly viz = input.required<FactViz>();

  protected readonly split = computed(() => {
    const v = this.viz();
    return v.kind === 'split' ? { parts: v.parts, total: v.parts.reduce((a, p) => a + p.value, 0) } : null;
  });
  protected readonly share = computed(() => {
    const v = this.viz();
    return v.kind === 'share' ? v : null;
  });
  protected readonly growth = computed(() => {
    const v = this.viz();
    return v.kind === 'growth' ? v : null;
  });
  protected readonly path = computed(() => {
    const g = this.growth();
    return g ? growthPath(g) : '';
  });

  private readonly pctFmt = new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 1 });
  protected pct(v: number): string {
    return this.pctFmt.format(v);
  }

  constructor() {
    inject(Motion).scoped((_scope, root) => {
      const once = () =>
        onScroll({ target: root, enter: { container: 'bottom', target: 'top' }, repeat: false });
      const segs = root.querySelectorAll('.bar__seg');
      if (segs.length) {
        animate(segs, {
          scaleX: [0, 1],
          duration: 1100,
          delay: stagger(160),
          ease: 'out(4)',
          autoplay: once(),
        });
      }
      const line = root.querySelectorAll<SVGPathElement>('.growth__line');
      if (line.length) {
        animate(svg.createDrawable(line), {
          draw: ['0 0', '0 1'],
          duration: 1600,
          ease: 'inOut(3)',
          autoplay: once(),
        });
        animate(root.querySelectorAll('.growth__area, .growth__end'), {
          opacity: [0, 1],
          duration: 800,
          delay: 1100,
          autoplay: once(),
        });
      }
    });
  }
}
