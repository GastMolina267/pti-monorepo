import type { AlertKind, TriageLevel } from '../clinical/triage';
import type { AlertStatus } from './alerts';

/** Ventana por defecto y máxima de `GET /api/tickets/:id/readings` (minutos). */
export const VITALS_HISTORY_DEFAULT_MINUTES = 120;
export const VITALS_HISTORY_MAX_MINUTES = 24 * 60;
/** La API agrupa las lecturas para no devolver más de esta cantidad de puntos. */
export const VITALS_HISTORY_MAX_POINTS = 600;

/**
 * Un punto de la curva. Si la ventana es larga, agrupa varias lecturas: promedio de
 * `hr`/`spo2`/`temp`, máximo de `accPeakG`, `fall` si hubo alguna caída y el nivel más grave.
 */
export interface VitalsPoint {
  /** ISO-8601, inicio del intervalo (o la hora de la lectura si no se agrupó). */
  at: string;
  hr: number | null;
  spo2: number | null;
  temp: number | null;
  accPeakG: number | null;
  fall: boolean;
  level: TriageLevel;
  /** Lecturas que resume el punto. */
  samples: number;
}

/** `GET /api/tickets/:id/readings?minutes=` */
export interface VitalsHistory {
  ticketId: string;
  /** Código de la pulsera asignada ahora (puede no haber). */
  wearableCode: string | null;
  from: string;
  to: string;
  /** Segundos que agrupa cada punto (3 = una lectura por punto). */
  bucketSeconds: number;
  points: VitalsPoint[];
  /** Alertas del turno en la ventana, para marcarlas sobre la curva. */
  alerts: { id: string; kind: AlertKind; status: AlertStatus; detectedAt: string }[];
}

export interface VitalsHistoryQuery {
  minutes?: number;
}
