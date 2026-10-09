/**
 * Identificador del wearable: `wb-<NN>-<mac>` (ADR 0011).
 * - `NN`: número físico de la pulsera (etiqueta), 01–99.
 * - `mac`: últimos 3 bytes de la MAC Wi-Fi en hex minúscula, para diagnosticar la red.
 *
 * Es el `<id>` del tópico MQTT, el `wearableId` de la lectura, `wearables.code` en la base
 * y (Fase 4) el usuario de Mosquitto.
 */
export const WEARABLE_CODE_PATTERN = /^wb-(\d{2})-([0-9a-f]{6})$/;

export const WEARABLE_NUMBER_MIN = 1;
export const WEARABLE_NUMBER_MAX = 99;

export interface WearableCodeParts {
  /** Número físico de la pulsera (1–99). */
  number: number;
  /** Últimos 3 bytes de la MAC, 6 caracteres hex en minúscula. */
  macSuffix: string;
}

/** `7` + `24D7CC` → `wb-07-24d7cc`. Lanza `RangeError` si las partes no son válidas. */
export function formatWearableCode(number: number, macSuffix: string): string {
  if (!Number.isInteger(number) || number < WEARABLE_NUMBER_MIN || number > WEARABLE_NUMBER_MAX) {
    throw new RangeError(`Número de wearable fuera de rango (1–99): ${number}`);
  }
  const mac = macSuffix.toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(mac)) {
    throw new RangeError(`Sufijo de MAC inválido (6 hex): ${macSuffix}`);
  }
  return `wb-${String(number).padStart(2, '0')}-${mac}`;
}

/** `wb-07-24d7cc` → `{ number: 7, macSuffix: '24d7cc' }`; `null` si no respeta el formato. */
export function parseWearableCode(code: string): WearableCodeParts | null {
  const match = WEARABLE_CODE_PATTERN.exec(code);
  if (!match) return null;
  const number = Number(match[1]);
  if (number < WEARABLE_NUMBER_MIN) return null;
  return { number, macSuffix: match[2] };
}
