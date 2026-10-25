import type { AlertKind, TriageLevel, VitalsAssessment } from '../clinical/triage';
import type { TelemetryReading } from '../telemetry/mqtt';
import type { TicketStatus } from '../tickets/tickets';

/**
 * Nombres de eventos WebSocket (Socket.IO) emitidos por la API.
 * Fuente única de verdad para backend (gateway) y frontends (backoffice, TV, portal).
 * Convención: `<dominio>:<acción>` en minúsculas.
 */
export const REALTIME_EVENTS = {
  /** Un profesional llamó un turno a consultorio (TV, app paciente, OLED del wearable). */
  TICKET_CALLED: 'ticket:called',
  /** Cambió el estado o la posición de la fila de espera. */
  QUEUE_UPDATED: 'queue:updated',
  /** Nueva lectura biométrica procesada para un paciente. */
  TELEMETRY_READING: 'telemetry:reading',
  /** Alerta clínica crítica (caída, hipoxia, etc.). Latencia objetivo < 500 ms. */
  ALERT_EMERGENCY: 'alert:emergency',
  /** Una alerta fue reconocida por el personal. */
  ALERT_ACKNOWLEDGED: 'alert:acknowledged',
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

/** Salas (rooms) de Socket.IO para segmentar audiencias. */
export const REALTIME_ROOMS = {
  STAFF: 'staff',
  TV: 'tv',
  patient: (ticketId: string) => `patient:${ticketId}`,
} as const;

/**
 * Datos del handshake de Socket.IO (`io({ auth })`) que eligen la sala:
 * - `{ token }`: JWT del personal → sala `staff` (si el token es inválido, se desconecta).
 * - `{ role: 'tv' }`: pantalla llamadora → sala `tv` (sin datos clínicos).
 * - `{ ticketId }`: paciente siguiendo su turno → sala `patient:<ticketId>`.
 */
export type RealtimeHandshakeAuth = { token: string } | { role: 'tv' } | { ticketId: string };

/** El servidor confirma la sala apenas une al cliente (`{ room }`): recién ahí llegan eventos. */
export const REALTIME_READY_EVENT = 'realtime:ready';

/** Evento de error que el servidor emite antes de desconectar un handshake inválido (`{ message }`). */
export const REALTIME_ERROR_EVENT = 'realtime:error';

export interface TicketCalledEvent {
  ticketId: string;
  /** Código visible del turno, ej. `A-024`. */
  ticketCode: string;
  consultingRoom: string;
  professionalName?: string;
  /** Código del servicio (`ServiceArea.code`): la TV de una sala filtra por este campo. */
  serviceCode?: string;
  calledAt: string;
}

/** Qué cambió en la fila. */
export const QUEUE_CHANGES = ['CHECK_IN', 'CALLED', 'STATUS', 'TRIAGE'] as const;
export type QueueChange = (typeof QUEUE_CHANGES)[number];

/**
 * Aviso de que la fila de un servicio cambió (salas `staff` y `tv`). Es un aviso liviano y
 * sin datos clínicos: el Backoffice vuelve a pedir `GET /api/tickets` y la TV su vista.
 */
export interface QueueUpdatedEvent {
  change: QueueChange;
  ticketId: string;
  ticketCode: string;
  serviceCode: string;
  status: TicketStatus;
  /** Turnos en espera en ese servicio después del cambio. */
  waitingCount: number;
  at: string;
}

/** Lectura procesada (solo sala `staff`). */
export interface TelemetryReadingEvent {
  /** Código del wearable (`wb-<NN>-<mac>`). */
  wearableId: string;
  ticketId: string | null;
  ticketCode: string | null;
  reading: TelemetryReading;
  assessment: VitalsAssessment;
  /** ISO-8601, cuándo la recibió el gateway (para medir latencia contra `reading.ts`). */
  receivedAt: string;
}

export interface AlertEmergencyEvent {
  alertId: string;
  /** Código del wearable (`wb-<NN>-<mac>`). */
  wearableId: string;
  ticketId?: string;
  patientId?: string;
  ticketCode?: string;
  kind: AlertKind;
  level: TriageLevel;
  message: string;
  /** ISO-8601, hora del wearable (`reading.ts`): la latencia se mide contra este valor. */
  detectedAt: string;
}

export interface AlertAcknowledgedEvent {
  alertId: string;
  by: { id: string; fullName: string };
  at: string;
}
