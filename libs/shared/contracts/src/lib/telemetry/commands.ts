/**
 * Comandos del Edge Gateway al wearable, publicados en `MQTT_TOPICS.wearableCommand(room, id)`
 * (`hospital/<sala>/wearable/<id>/cmd`) con QoS 1 y sin retain.
 *
 * Viajan en claro (JSON): no llevan signos vitales ni datos personales, solo el código del
 * turno y el consultorio, lo mismo que muestra la TV. En la Fase 4 la ACL de Mosquitto
 * limita quién publica en `cmd`.
 */
export const WEARABLE_COMMAND_TYPES = ['SHOW_TICKET'] as const;
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

export type WearableCommand = ShowTicketCommand;

/** Sala por defecto del tópico cuando todavía no se recibió ninguna lectura del wearable. */
export const DEFAULT_WEARABLE_ROOM = 'sala1';
