import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  ALERT_KIND_LABELS,
  CLINICAL_THRESHOLDS as T,
  vitalsFindings,
  type VitalsHistory,
  type VitalsPoint,
} from '@vitalia/contracts';

type Metric = 'hr' | 'spo2' | 'temp';

interface PanelSpec {
  key: Metric;
  label: string;
  unit: string;
  /** Rango mínimo del eje (se amplía si los datos se salen). */
  domain: [number, number];
  /** Banda normal de la tesis (§5.1.1), sombreada de fondo. */
  normal: [number, number];
  decimals: number;
}

const PANELS: PanelSpec[] = [
  {
    key: 'hr',
    label: 'Frecuencia cardíaca',
    unit: 'lpm',
    domain: [40, 140],
    normal: [T.heartRate.normalMin, T.heartRate.normalMax],
    decimals: 0,
  },
  {
    key: 'spo2',
    label: 'Saturación de oxígeno',
    unit: '%',
    domain: [85, 100],
    normal: [T.spo2.normalMin, 100],
    decimals: 0,
  },
  {
    key: 'temp',
    label: 'Temperatura',
    unit: '°C',
    domain: [35, 39],
    normal: [T.temperature.hypothermiaBelow, T.temperature.feverAbove],
    decimals: 1,
  },
];

const PANEL_H = 96;
const PAD = { top: 10, right: 12, bottom: 6, left: 40 };
const AXIS_H = 22;

export interface PanelView {
  spec: PanelSpec;
  path: string;
  band: { y: number; h: number };
  ticks: { y: number; label: string }[];
  critical: { x: number; y: number }[];
  last: number | null;
}

/** Arma el `d` de un `<path>`, cortando la línea donde falta el dato o hay un hueco de tiempo. */
export function linePath(xy: ({ x: number; y: number } | null)[]): string {
  let d = '';
  let pen = false;
  for (const p of xy) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    pen = true;
  }
  return d;
}

/** Dominio del eje: el mínimo del panel, ampliado para que entren todos los valores. */
export function domainFor(values: number[], base: [number, number]): [number, number] {
  if (!values.length) return base;
  return [
    Math.min(base[0], Math.floor(Math.min(...values))),
    Math.max(base[1], Math.ceil(Math.max(...values))),
  ];
}

const hhmm = (ms: number) =>
  new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * Curva de signos vitales en tres paneles (uno por unidad, mismo eje de tiempo): nunca dos
 * escalas en un mismo gráfico. Banda normal sombreada, puntos críticos en rojo con anillo,
 * alertas y caídas como líneas verticales rotuladas, y cruz de lectura sincronizada al pasar
 * el mouse (o el dedo). Los colores salen de los tokens, así que funciona en claro y oscuro.
 */
@Component({
  selector: 'vt-vitals-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vitals-chart.html',
  styleUrl: './vitals-chart.scss',
})
export class VitalsChart {
  readonly history = input.required<VitalsHistory>();

  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly width = signal(640);
  protected readonly hover = signal<number | null>(null);
  protected readonly alertLabels = ALERT_KIND_LABELS;
  protected readonly panelH = PANEL_H;
  protected readonly axisH = AXIS_H;
  protected readonly pad = PAD;

  private readonly span = computed(() => {
    const h = this.history();
    return { from: new Date(h.from).getTime(), to: new Date(h.to).getTime() };
  });
  private readonly innerW = computed(() => Math.max(120, this.width() - PAD.left - PAD.right));

  readonly x = (ms: number) => {
    const { from, to } = this.span();
    return PAD.left + ((ms - from) / Math.max(1, to - from)) * this.innerW();
  };

  private readonly times = computed(() => this.history().points.map((p) => new Date(p.at).getTime()));

  protected readonly panels = computed<PanelView[]>(() => {
    const pts = this.history().points;
    const times = this.times();
    // Un hueco de más de 3 intervalos (pulsera sin señal) corta la línea.
    const gap = this.history().bucketSeconds * 3 * 1000;
    return PANELS.map((spec) => {
      const values = pts.map((p) => p[spec.key]).filter((v): v is number => v !== null);
      const [lo, hi] = domainFor(values, spec.domain);
      const y = (v: number) =>
        PAD.top + (1 - (v - lo) / Math.max(1e-6, hi - lo)) * (PANEL_H - PAD.top - PAD.bottom);
      // Un hueco de tiempo levanta el lápiz: se inserta un null antes del punto que lo sigue.
      const xy = pts.flatMap((p, i) => {
        const v = p[spec.key];
        const point = v === null ? null : { x: this.x(times[i]), y: y(v) };
        return i > 0 && times[i] - times[i - 1] > gap ? [null, point] : [point];
      });
      const critical = pts.flatMap((p, i) => {
        const v = p[spec.key];
        return v !== null && vitalsFindings({ [spec.key]: v })[0]?.level === 'CRITICAL'
          ? [{ x: this.x(times[i]), y: y(v) }]
          : [];
      });
      const top = y(Math.min(hi, spec.normal[1]));
      const bottom = y(Math.max(lo, spec.normal[0]));
      return {
        spec,
        path: linePath(xy),
        band: { y: top, h: Math.max(0, bottom - top) },
        ticks: [hi, (lo + hi) / 2, lo].map((v) => ({ y: y(v), label: v.toFixed(spec.decimals ? 1 : 0) })),
        critical,
        last: values.length ? values[values.length - 1] : null,
      };
    });
  });

  protected readonly markers = computed(() => {
    const h = this.history();
    const alerts = h.alerts.map((a) => ({
      x: this.x(new Date(a.detectedAt).getTime()),
      label: ALERT_KIND_LABELS[a.kind],
    }));
    // Caídas sin alerta propia (la alerta activa no se repite).
    const falls = h.points
      .filter((p) => p.fall)
      .map((p) => ({ x: this.x(new Date(p.at).getTime()), label: 'Caída' }))
      .filter((f) => !alerts.some((a) => Math.abs(a.x - f.x) < 6));
    return [...alerts, ...falls];
  });

  protected readonly xTicks = computed(() => {
    const { from, to } = this.span();
    const n = this.width() < 420 ? 3 : 5;
    return Array.from({ length: n }, (_, i) => {
      const ms = from + ((to - from) * i) / (n - 1);
      return { x: this.x(ms), label: hhmm(ms), anchor: i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' };
    });
  });

  protected readonly hovered = computed<{ point: VitalsPoint; x: number } | null>(() => {
    const i = this.hover();
    if (i === null) return null;
    const point = this.history().points[i];
    return point ? { point, x: this.x(this.times()[i]) } : null;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.host.nativeElement as HTMLElement;
      // jsdom (tests) no tiene ResizeObserver: queda el ancho por defecto.
      if (typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(([entry]) => this.width.set(Math.round(entry.contentRect.width) || 640));
      ro.observe(el);
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  protected onMove(e: PointerEvent): void {
    const svg = e.currentTarget as SVGElement;
    const px = e.clientX - svg.getBoundingClientRect().left;
    const times = this.times();
    if (!times.length) return;
    let best = 0;
    for (let i = 1; i < times.length; i++) {
      if (Math.abs(this.x(times[i]) - px) < Math.abs(this.x(times[best]) - px)) best = i;
    }
    this.hover.set(best);
  }

  protected fmt(v: number | null, decimals: number): string {
    return v === null ? '—' : v.toFixed(decimals);
  }

  protected time(at: string): string {
    return hhmm(new Date(at).getTime());
  }

  protected tooltipLeft(x: number): number {
    return Math.min(Math.max(x + 12, 0), this.width() - 180);
  }
}
