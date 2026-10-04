import type { TriageLevel } from '../clinical/triage';

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

export interface TicketCalledEvent {
  ticketId: string;
  /** Código visible del turno, ej. `A-024`. */
  ticketCode: string;
  consultingRoom: string;
  professionalName?: string;
  calledAt: string;
}

export interface AlertEmergencyEvent {
  alertId: string;
  wearableId: string;
  patientId?: string;
  ticketCode?: string;
  kind: 'FALL' | 'HYPOXIA' | 'TACHYCARDIA' | 'BRADYCARDIA' | 'FEVER' | 'HYPOTHERMIA';
  level: TriageLevel;
  message: string;
  detectedAt: string;
}
