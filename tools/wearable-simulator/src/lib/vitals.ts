import { CLINICAL_THRESHOLDS as T } from '@vitalia/contracts';
import { between, jitter, type Rng } from './rng';

/** Anomalías que se pueden inyectar en un paciente simulado. */
export const ANOMALY_KINDS = [
  'fall',
  'hypoxia',
  'tachycardia',
  'bradycardia',
  'fever',
  'hypothermia',
] as const;
export type AnomalyKind = (typeof ANOMALY_KINDS)[number];

type SustainedKind = Exclude<AnomalyKind, 'fall'>;

export interface Vitals {
  hr: number;
  spo2: number;
  temp: number;
  accPeakG: number;
  fall: boolean;
}

/**
 * Valor de cada anomalía sostenida, derivado de CLINICAL_THRESHOLDS para caer siempre en
 * CRÍTICO según assessVitals(). Si cambian los umbrales del contrato, el simulador los sigue.
 */
function anomalyTarget(kind: SustainedKind, rng: Rng): number {
  switch (kind) {
    case 'hypoxia':
      return Math.round(between(rng, T.spo2.criticalBelow - 6, T.spo2.criticalBelow - 2));
    case 'tachycardia':
      return Math.round(between(rng, T.heartRate.criticalMax + 8, T.heartRate.criticalMax + 20));
    case 'bradycardia':
      return Math.round(between(rng, T.heartRate.criticalMin - 8, T.heartRate.criticalMin - 4));
    case 'fever':
      return between(rng, T.temperature.criticalAbove + 0.2, T.temperature.criticalAbove + 0.7);
    case 'hypothermia':
      return between(rng, T.temperature.hypothermiaBelow - 0.8, T.temperature.hypothermiaBelow - 0.3);
  }
}

const AFFECTS: Record<SustainedKind, 'hr' | 'spo2' | 'temp'> = {
  hypoxia: 'spo2',
  tachycardia: 'hr',
  bradycardia: 'hr',
  fever: 'temp',
  hypothermia: 'temp',
};

/** Cuánto vuelve hacia el valor basal en cada lectura después de una anomalía. */
const RECOVERY = 0.25;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Signos vitales de un paciente en la sala de espera. En reposo, cada valor oscila cerca de
 * un basal propio dentro del rango normal (ESTABLE). Una anomalía sostenida fija la variable
 * afectada en rango crítico desde la primera lectura (para medir latencias) y, al terminar,
 * vuelve gradualmente al basal, pasando por ATENCIÓN como un paciente real.
 */
export class VitalsModel {
  private readonly base: { hr: number; spo2: number; temp: number };
  private hr: number;
  private spo2: number;
  private temp: number;
  private sustained: { kind: SustainedKind; untilMs: number; target: number } | null = null;
  private fallPending = false;
  private stillUntilMs = 0;

  constructor(private readonly rng: Rng) {
    this.base = {
      hr: between(rng, T.heartRate.normalMin + 8, T.heartRate.normalMax - 15),
      spo2: between(rng, T.spo2.normalMin + 1.5, 99.5),
      temp: between(rng, T.temperature.feverAbove - 1.2, T.temperature.feverAbove - 0.6),
    };
    this.hr = this.base.hr;
    this.spo2 = this.base.spo2;
    this.temp = this.base.temp;
  }

  /** Inyecta una anomalía. `fall` es instantánea; `durationMs` es la inmovilidad posterior. */
  start(kind: AnomalyKind, nowMs: number, durationMs: number): void {
    if (kind === 'fall') {
      this.fallPending = true;
      this.stillUntilMs = nowMs + durationMs;
      return;
    }
    this.sustained = { kind, untilMs: nowMs + durationMs, target: anomalyTarget(kind, this.rng) };
  }

  /** Anomalía en curso (o `null`). */
  active(nowMs: number): AnomalyKind | null {
    if (this.fallPending || nowMs < this.stillUntilMs) return 'fall';
    if (this.sustained && nowMs < this.sustained.untilMs) return this.sustained.kind;
    return null;
  }

  next(nowMs: number): Vitals {
    if (this.sustained && nowMs >= this.sustained.untilMs) this.sustained = null;
    const affected = this.sustained ? AFFECTS[this.sustained.kind] : null;
    const target = this.sustained?.target ?? 0;

    this.hr = affected === 'hr' ? target + jitter(this.rng, 2) : this.recover(this.hr, this.base.hr, 2);
    this.spo2 =
      affected === 'spo2' ? target + jitter(this.rng, 1) : this.recover(this.spo2, this.base.spo2, 0.4);
    this.temp =
      affected === 'temp' ? target + jitter(this.rng, 0.05) : this.recover(this.temp, this.base.temp, 0.06);

    const fall = this.fallPending;
    this.fallPending = false;
    let accPeakG: number;
    if (fall) accPeakG = between(this.rng, T.fall.impactG + 0.4, T.fall.impactG + 1.7);
    else if (nowMs < this.stillUntilMs)
      accPeakG = between(this.rng, 1.0, 1.06); // inmóvil en el piso
    else accPeakG = between(this.rng, 1.0, 1.35); // sentado: movimientos chicos de la muñeca

    return {
      hr: Math.round(clamp(this.hr, 25, 220)),
      spo2: Math.round(clamp(this.spo2, 60, 100)),
      temp: Math.round(clamp(this.temp, 30, 43) * 10) / 10,
      accPeakG: Math.round(accPeakG * 100) / 100,
      fall,
    };
  }

  private recover(value: number, base: number, noise: number): number {
    return value + (base - value) * RECOVERY + jitter(this.rng, noise);
  }
}
