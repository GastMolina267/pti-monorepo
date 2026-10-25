import type { StaffRole } from '../auth/auth';
import type { TriageLevel } from '../clinical/triage';

/** Estado administrativo de la pulsera. `online` se calcula aparte, por `lastSeenAt`. */
export const WEARABLE_STATUSES = ['AVAILABLE', 'ASSIGNED', 'OFFLINE', 'MAINTENANCE'] as const;
export type WearableStatus = (typeof WEARABLE_STATUSES)[number];

export const WEARABLE_STATUS_LABELS: Record<WearableStatus, string> = {
  AVAILABLE: 'Disponible',
  ASSIGNED: 'Asignada',
  OFFLINE: 'Fuera de línea',
  MAINTENANCE: 'En mantenimiento',
};

/** Sin lecturas durante este tiempo, la pulsera se muestra desconectada. */
export const WEARABLE_ONLINE_WINDOW_MS = 30_000;

/** Última lectura conocida de una pulsera (vista del personal). */
export interface WearableLastReading {
  seq: number;
  /** ISO-8601, hora del wearable. */
  measuredAt: string;
  hr: number | null;
  spo2: number | null;
  temp: number | null;
  accPeakG: number | null;
  fall: boolean;
  level: TriageLevel;
}

/** `GET /api/wearables` */
export interface Wearable {
  id: string;
  /** `wb-<NN>-<mac>` (ADR 0011). */
  code: string;
  /** Número físico de la pulsera (1–99). */
  number: number;
  label: string | null;
  status: WearableStatus;
  /** `true` si publicó en los últimos {@link WEARABLE_ONLINE_WINDOW_MS}. */
  online: boolean;
  /** Sala del tópico MQTT de la última lectura (para los comandos). */
  room: string | null;
  ticket: { id: string; code: string; patientDisplayName: string } | null;
  lastSeenAt: string | null;
  lastReading: WearableLastReading | null;
}

/** `POST /api/wearables` */
export interface CreateWearableRequest {
  code: string;
  label?: string;
}

/** `POST /api/wearables/:id/assign` */
export interface AssignWearableRequest {
  ticketId: string;
}

/**
 * `PATCH /api/wearables/:id`. Solo se pasa a mantenimiento una pulsera libre; `ASSIGNED`
 * no se setea a mano (lo maneja la asignación).
 */
export interface UpdateWearableRequest {
  label?: string | null;
  status?: Extract<WearableStatus, 'AVAILABLE' | 'MAINTENANCE'>;
}

/** Roles que dan de alta pulseras. Asignar y liberar lo puede hacer todo el personal. */
export const ROLES_CAN_MANAGE_WEARABLES: readonly StaffRole[] = ['ADMIN', 'NURSE'];
