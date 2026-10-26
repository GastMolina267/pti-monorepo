/**
 * Comandos del Edge Gateway al wearable, publicados en `MQTT_TOPICS.wearableCommand(room, id)`
 * (`hospital/<sala>/wearable/<id>/cmd`) con QoS 1 y sin retain.
 *
 * Viajan en claro (JSON): no llevan signos vitales ni datos personales, solo el código del
 * turno y el consultorio, lo mismo que muestra la TV. Nunca el nombre del paciente. En la
 * Fase 4 la ACL de Mosquitto limita quién publica en `cmd`.
 *
 * Cada comando lleva el estado completo de la pulsera (ADR 0021): si llegan varios seguidos,
 * alcanza con aplicar el último.
 * - `ASSIGN_TICKET`: asignada a un turno → el OLED muestra `Turno <código>`.
 * - `SHOW_TICKET`: ese turno fue llamado → `TE LLAMAN` con el consultorio.
 * - `CLEAR_TICKET`: el turno dejó de estar llamado (en atención, de vuelta a la fila, ausente)
 *   → termina el llamado, sigue asignada.
 * - `RELEASE_WEARABLE`: se liberó la pulsera → sin turno ni llamado.
 *
 * Un `type` desconocido se ignora, así que agregar comandos no rompe firmwares viejos.
 */
export const WEARABLE_COMMAND_TYPES = [
  'SHOW_TICKET',
  'ASSIGN_TICKET',
  'CLEAR_TICKET',
  'RELEASE_WEARABLE',
] as const;
export type WearableCommandType = (typeof WEARABLE_COMMAND_TYPES)[number];

/** Límites de recepción en bytes UTF-8, sin contar el terminador C. No cambian el payload. */
export const WEARABLE_COMMAND_LIMITS = {
  payloadBytes: 512,
  ticketCodeBytes: 16,
  consultingRoomBytes: 320, // hasta 80 caracteres de 4 bytes (columna de la API)
} as const;

/** Mostrar en el OLED que el turno fue llamado: `A-024 → Cons. 4`. */
export interface ShowTicketCommand {
  type: 'SHOW_TICKET';
  /** Código visible del turno, ej. `A-024`. */
  ticketCode: string;
  /** Nombre del consultorio, ej. `Consultorio 4`. */
  consultingRoom: string;
}

/** La pulsera quedó asignada a un turno que todavía no fue llamado. */
export interface AssignTicketCommand {
  type: 'ASSIGN_TICKET';
  ticketCode: string;
}

/** El turno dejó de estar llamado. El firmware solo lo aplica si coincide con su llamado. */
export interface ClearTicketCommand {
  type: 'CLEAR_TICKET';
  ticketCode: string;
}

/** La pulsera quedó libre (turno finalizado o cancelado, o liberada a mano). */
export interface ReleaseWearableCommand {
  type: 'RELEASE_WEARABLE';
}

export type WearableCommand =
  ShowTicketCommand | AssignTicketCommand | ClearTicketCommand | ReleaseWearableCommand;

/** Sala por defecto del tópico cuando todavía no se recibió ninguna lectura del wearable. */
export const DEFAULT_WEARABLE_ROOM = 'sala1';
