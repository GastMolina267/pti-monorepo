import type { AlertKind, TriageLevel } from '../clinical/triage';

export const ALERT_STATUSES = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  ACTIVE: 'Activa',
  ACKNOWLEDGED: 'Reconocida',
  RESOLVED: 'Resuelta',
};

/** `GET /api/alerts` */
export interface Alert {
  id: string;
  kind: AlertKind;
  level: TriageLevel;
  status: AlertStatus;
  message: string;
  /** Código del wearable (`wb-<NN>-<mac>`). */
  wearableId: string;
  ticketId: string | null;
  ticketCode: string | null;
  patientDisplayName: string | null;
  detectedAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: { id: string; fullName: string } | null;
}

/** `GET /api/alerts?active=` */
export interface AlertQuery {
  /** `true` (por defecto): solo las activas. `false`: las últimas 100 de cualquier estado. */
  active?: boolean;
}
