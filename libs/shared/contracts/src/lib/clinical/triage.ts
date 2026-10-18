import type { TelemetryReading } from '../telemetry/mqtt';
import { CLINICAL_THRESHOLDS as T } from './thresholds';

export const TRIAGE_LEVELS = ['STABLE', 'ATTENTION', 'CRITICAL'] as const;
export type TriageLevel = (typeof TRIAGE_LEVELS)[number];

export const TRIAGE_LEVEL_LABELS: Record<TriageLevel, string> = {
  STABLE: 'Estable',
  ATTENTION: 'Atención',
  CRITICAL: 'Crítico',
};

/** Tipos de hallazgo clínico. Cada hallazgo CRÍTICO genera una alerta de ese tipo. */
export const ALERT_KINDS = ['FALL', 'HYPOXIA', 'TACHYCARDIA', 'BRADYCARDIA', 'FEVER', 'HYPOTHERMIA'] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  FALL: 'Caída',
  HYPOXIA: 'Hipoxia',
  TACHYCARDIA: 'Taquicardia',
  BRADYCARDIA: 'Bradicardia',
  FEVER: 'Fiebre',
  HYPOTHERMIA: 'Hipotermia',
};

export interface VitalsFinding {
  level: Exclude<TriageLevel, 'STABLE'>;
  kind: AlertKind;
  /** Motivo legible en español, ej. `Hipoxia (SpO₂ 87%)`. */
  reason: string;
}

export interface VitalsAssessment {
  level: TriageLevel;
  /** Motivos legibles en español, ordenados por severidad. */
  reasons: string[];
}

const rank: Record<TriageLevel, number> = { STABLE: 0, ATTENTION: 1, CRITICAL: 2 };

/**
 * Hallazgos de una lectura, ordenados de mayor a menor severidad. La API crea una
 * alerta por cada hallazgo CRÍTICO (con su `kind`); {@link assessVitals} los resume.
 */
export function vitalsFindings(r: Partial<TelemetryReading>): VitalsFinding[] {
  const findings: VitalsFinding[] = [];
  const add = (level: VitalsFinding['level'], kind: AlertKind, reason: string) =>
    findings.push({ level, kind, reason });

  if (r.fall) add('CRITICAL', 'FALL', 'Caída detectada');

  if (r.spo2 !== undefined) {
    if (r.spo2 < T.spo2.criticalBelow) add('CRITICAL', 'HYPOXIA', `Hipoxia (SpO₂ ${r.spo2}%)`);
    else if (r.spo2 < T.spo2.normalMin) add('ATTENTION', 'HYPOXIA', `SpO₂ baja (${r.spo2}%)`);
  }

  if (r.hr !== undefined) {
    if (r.hr < T.heartRate.criticalMin)
      add('CRITICAL', 'BRADYCARDIA', `Frecuencia cardíaca crítica (${r.hr} BPM)`);
    else if (r.hr > T.heartRate.criticalMax)
      add('CRITICAL', 'TACHYCARDIA', `Frecuencia cardíaca crítica (${r.hr} BPM)`);
    else if (r.hr < T.heartRate.normalMin) add('ATTENTION', 'BRADYCARDIA', `Bradicardia (${r.hr} BPM)`);
    else if (r.hr > T.heartRate.normalMax) add('ATTENTION', 'TACHYCARDIA', `Taquicardia (${r.hr} BPM)`);
  }

  if (r.temp !== undefined) {
    if (r.temp > T.temperature.criticalAbove) add('CRITICAL', 'FEVER', `Fiebre alta (${r.temp} °C)`);
    else if (r.temp > T.temperature.feverAbove) add('ATTENTION', 'FEVER', `Fiebre (${r.temp} °C)`);
    else if (r.temp < T.temperature.hypothermiaBelow)
      add('CRITICAL', 'HYPOTHERMIA', `Hipotermia (${r.temp} °C)`);
  }

  // sort es estable: a igual severidad se respeta el orden de arriba (caída primero).
  return findings.sort((a, b) => rank[b.level] - rank[a.level]);
}

/**
 * Clasifica una lectura en ESTABLE / ATENCIÓN / CRÍTICO.
 * Función pura compartida por la API (generación de alertas) y el Backoffice
 * (colores de la fila de triaje), para que ambos usen la misma regla.
 */
export function assessVitals(r: Partial<TelemetryReading>): VitalsAssessment {
  const findings = vitalsFindings(r);
  return {
    level: findings[0]?.level ?? 'STABLE',
    reasons: findings.map((f) => f.reason),
  };
}

/** `true` si `a` es más grave que `b` (para escalar el triaje sin bajarlo nunca). */
export function isMoreSevere(a: TriageLevel, b: TriageLevel): boolean {
  return rank[a] > rank[b];
}
