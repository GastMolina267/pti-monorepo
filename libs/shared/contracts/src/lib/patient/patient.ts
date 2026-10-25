import type { TriageLevel } from '../clinical/triage';
import type { PublicTicket } from '../tickets/tickets';

/**
 * App del paciente (Flutter, `apps/patient-app`). El paciente no tiene cuenta: accede con una
 * **sesión de turno**, un token firmado que solo sirve para ver ESE turno durante
 * {@link PATIENT_SESSION_HOURS} horas. Se obtiene de dos formas:
 *
 * - Check-in desde la app (`source: 'PATIENT_APP'`): la respuesta trae `patientSession` solo si
 *   el turno se creó en ese pedido. Un check-in repetido con el mismo DNI no la devuelve (el
 *   DNI no es un secreto).
 * - Código de vinculación: el personal lo genera en el Backoffice para un turno ya creado
 *   (portal cautivo o recepción) y el paciente lo escribe en la app.
 *
 * El token NO sirve en los endpoints del personal (se firma con otra clave).
 */
export const PATIENT_SESSION_HOURS = 24;

/** Largo del código de vinculación (ej. `K7M2QX`). */
export const PAIRING_CODE_LENGTH = 6;
export const PAIRING_CODE_TTL_MINUTES = 10;
/** Sin 0/O, 1/I/L ni 5/S: se dicta y se escribe sin confusiones. */
export const PAIRING_CODE_ALPHABET = '2346789ABCDEFGHJKMNPQRTUVWXYZ';

/** Sesión del paciente: `Authorization: Bearer <token>` en `/api/patient/*`. */
export interface PatientSession {
  token: string;
  /** ISO-8601. */
  expiresAt: string;
  ticketId: string;
}

/** `POST /api/tickets/:id/pairing` (personal) → código para escribir en la app. */
export interface PairingCode {
  code: string;
  /** ISO-8601. */
  expiresAt: string;
  ticketCode: string;
}

/** `POST /api/patient/pair` (público, con límite de intentos). */
export interface PairRequest {
  code: string;
}

/** Turno visto por su paciente: lo público más a dónde y con quién. */
export interface PatientTicket extends PublicTicket {
  serviceCode: string;
  triageLevel: TriageLevel;
  reason: string | null;
  /** Profesional que lo llamó (si ya lo llamaron). */
  professionalName: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

/** Última lectura de la pulsera asignada, con la evaluación clínica. */
export interface PatientVitals {
  wearableCode: string;
  measuredAt: string;
  hr: number | null;
  spo2: number | null;
  temp: number | null;
  fall: boolean;
  level: TriageLevel;
  reasons: string[];
}

/** `GET /api/patient/me` */
export interface PatientOverview {
  patient: {
    firstName: string;
    /** `Lucía G.` */
    displayName: string;
  };
  ticket: PatientTicket;
  /** `null` si no tiene pulsera o todavía no hay lecturas. */
  vitals: PatientVitals | null;
  serverTime: string;
}

/** Cómo se le muestra el triaje al paciente: prioridad, no diagnóstico. */
export const PATIENT_PRIORITY_LABELS: Record<TriageLevel, string> = {
  STABLE: 'Prioridad habitual',
  ATTENTION: 'Prioridad media',
  CRITICAL: 'Prioridad alta',
};
