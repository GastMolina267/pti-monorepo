import type { TriageLevel } from '../clinical/triage';
import type { ConsultingRoom, ServiceArea } from '../catalog/catalog';
import type { TicketCalledEvent } from '../realtime/events';

/** Ciclo de vida de un turno. */
export const TICKET_STATUSES = ['WAITING', 'CALLED', 'IN_PROGRESS', 'DONE', 'NO_SHOW', 'CANCELLED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  WAITING: 'En espera',
  CALLED: 'Llamado',
  IN_PROGRESS: 'En atención',
  DONE: 'Finalizado',
  NO_SHOW: 'Ausente',
  CANCELLED: 'Cancelado',
};

/** Estados "abiertos": el paciente sigue en la sala o en atención. */
export const OPEN_TICKET_STATUSES: readonly TicketStatus[] = ['WAITING', 'CALLED', 'IN_PROGRESS'];

/**
 * Transiciones permitidas. `CALLED → WAITING` permite devolver a la fila
 * a un paciente que no respondió al primer llamado.
 */
export const TICKET_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  WAITING: ['CALLED', 'CANCELLED'],
  CALLED: ['IN_PROGRESS', 'WAITING', 'NO_SHOW', 'CALLED'],
  IN_PROGRESS: ['DONE'],
  DONE: [],
  NO_SHOW: ['WAITING'],
  CANCELLED: [],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return TICKET_TRANSITIONS[from].includes(to);
}

/** Origen del check-in. */
export const CHECK_IN_SOURCES = ['CAPTIVE_PORTAL', 'KIOSK', 'RECEPTION'] as const;
export type CheckInSource = (typeof CHECK_IN_SOURCES)[number];

/** Código visible del turno: `A` + 24 → `A-024`. */
export function formatTicketCode(prefix: string, number: number): string {
  return `${prefix}-${String(number).padStart(3, '0')}`;
}

const TRIAGE_PRIORITY: Record<TriageLevel, number> = { CRITICAL: 0, ATTENTION: 1, STABLE: 2 };

/**
 * Orden de la fila de espera (RF-O4): primero por nivel de triaje (crítico primero)
 * y después por hora de check-in (el que llegó antes, primero).
 * Usado por la API (posición en la fila) y el Backoffice (orden visual).
 */
export function compareQueueOrder(
  a: Pick<Ticket, 'triageLevel' | 'checkedInAt'>,
  b: Pick<Ticket, 'triageLevel' | 'checkedInAt'>,
): number {
  const byLevel = TRIAGE_PRIORITY[a.triageLevel] - TRIAGE_PRIORITY[b.triageLevel];
  if (byLevel !== 0) return byLevel;
  return new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime();
}

/** Turno completo (vista del personal). */
export interface Ticket {
  id: string;
  /** Código visible, ej. `A-024`. */
  code: string;
  status: TicketStatus;
  triageLevel: TriageLevel;
  source: CheckInSource;
  /** Motivo de consulta declarado (opcional). */
  reason?: string | null;
  service: ServiceArea;
  patient: {
    id: string;
    /** Nombre para mostrar, ej. `Lucía G.` (minimiza datos personales). */
    displayName: string;
  };
  consultingRoom?: ConsultingRoom | null;
  checkedInAt: string;
  calledAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

/** Vista pública del turno para el paciente (portal / app). Sin datos clínicos. */
export interface PublicTicket {
  id: string;
  code: string;
  status: TicketStatus;
  serviceName: string;
  consultingRoomName?: string | null;
  /** Pacientes delante en la fila (solo si está WAITING). */
  position: number | null;
  /** Minutos estimados de espera (solo si está WAITING). */
  estimatedWaitMinutes: number | null;
  checkedInAt: string;
  calledAt?: string | null;
}

/** `POST /api/check-in` (público: portal cautivo o kiosk). */
export interface CheckInRequest {
  firstName: string;
  lastName: string;
  /** DNI (opcional; dato personal, Ley 25.326). */
  documentNumber?: string;
  /** Código del servicio (`ServiceArea.code`). */
  serviceCode: string;
  source: CheckInSource;
  reason?: string;
}

export type CheckInResponse = PublicTicket;

/** `GET /api/tickets` (filtros). */
export interface TicketQuery {
  /** Estados separados por coma. Por defecto, los abiertos. */
  status?: string;
  serviceCode?: string;
}

/** `POST /api/tickets/:id/call` */
export interface CallTicketRequest {
  consultingRoomId: string;
}

/** `PATCH /api/tickets/:id/status` */
export interface UpdateTicketStatusRequest {
  status: TicketStatus;
}

/** Cantidad de llamados que devuelve `GET /api/tickets/recent-calls`. */
export const RECENT_CALLS_LIMIT = 6;

/**
 * `GET /api/tickets/recent-calls?serviceCode=` (público): últimos llamados del día, el más
 * reciente primero; con `serviceCode`, solo los de ese servicio. Lo usa la TV al arrancar o reconectarse. Mismo formato que `ticket:called`
 * (sin datos clínicos).
 */
export type RecentCallsResponse = TicketCalledEvent[];

/** `PATCH /api/tickets/:id/triage` (triaje manual; la telemetría solo lo sube). */
export interface UpdateTriageRequest {
  triageLevel: TriageLevel;
}
