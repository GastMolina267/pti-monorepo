import type { TelemetryReading } from '../telemetry/mqtt';
import { CLINICAL_THRESHOLDS as T } from './thresholds';

export const TRIAGE_LEVELS = ['STABLE', 'ATTENTION', 'CRITICAL'] as const;
export type TriageLevel = (typeof TRIAGE_LEVELS)[number];

export interface VitalsAssessment {
  level: TriageLevel;
  /** Motivos legibles en español, ordenados por severidad. */
  reasons: string[];
}

const rank: Record<TriageLevel, number> = { STABLE: 0, ATTENTION: 1, CRITICAL: 2 };

/**
 * Clasifica una lectura en ESTABLE / ATENCIÓN / CRÍTICO.
 * Función pura compartida por la API (generación de alertas) y el Backoffice
 * (colores de la fila de triaje), para que ambos usen la misma regla.
 */
export function assessVitals(r: Partial<TelemetryReading>): VitalsAssessment {
  const findings: { level: TriageLevel; reason: string }[] = [];
  const add = (level: TriageLevel, reason: string) => findings.push({ level, reason });

  if (r.fall) add('CRITICAL', 'Caída detectada');

  if (r.spo2 !== undefined) {
    if (r.spo2 < T.spo2.criticalBelow) add('CRITICAL', `Hipoxia (SpO₂ ${r.spo2}%)`);
    else if (r.spo2 < T.spo2.normalMin) add('ATTENTION', `SpO₂ baja (${r.spo2}%)`);
  }

  if (r.hr !== undefined) {
    if (r.hr < T.heartRate.criticalMin || r.hr > T.heartRate.criticalMax)
      add('CRITICAL', `Frecuencia cardíaca crítica (${r.hr} BPM)`);
    else if (r.hr < T.heartRate.normalMin) add('ATTENTION', `Bradicardia (${r.hr} BPM)`);
    else if (r.hr > T.heartRate.normalMax) add('ATTENTION', `Taquicardia (${r.hr} BPM)`);
  }

  if (r.temp !== undefined) {
    if (r.temp > T.temperature.criticalAbove) add('CRITICAL', `Fiebre alta (${r.temp} °C)`);
    else if (r.temp > T.temperature.feverAbove) add('ATTENTION', `Fiebre (${r.temp} °C)`);
    else if (r.temp < T.temperature.hypothermiaBelow) add('CRITICAL', `Hipotermia (${r.temp} °C)`);
  }

  findings.sort((a, b) => rank[b.level] - rank[a.level]);
  return {
    level: findings[0]?.level ?? 'STABLE',
    reasons: findings.map((f) => f.reason),
  };
}
