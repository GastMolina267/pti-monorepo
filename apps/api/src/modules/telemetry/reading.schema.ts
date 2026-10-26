import {
  dropOutOfRangeFields,
  WEARABLE_CODE_PATTERN,
  type LimitedReadingField,
  type TelemetryReading,
} from '@vitalia/contracts';
import { z } from 'zod';
import { TelemetryRejection } from './telemetry-rejection';

/** Un `ts` anterior a 2024 es un reloj sin NTP o un epoch en segundos. */
export const MIN_READING_TS_MS = Date.UTC(2024, 0, 1);

/**
 * Validación del `TelemetryReading` descifrado. Estricta con la forma: un campo fuera del
 * contrato, un tipo equivocado o `wearableId`/`seq`/`ts`/`fall` inválidos descartan el
 * mensaje (está mal armado o alterado). El rango físico de las mediciones se aplica después,
 * en `parseReading`.
 */
export const telemetryReadingSchema = z.strictObject({
  wearableId: z.string().regex(WEARABLE_CODE_PATTERN, 'no es wb-<NN>-<mac>'),
  seq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  ts: z.number().int().min(MIN_READING_TS_MS, 'no es epoch en ms (¿segundos? ¿reloj sin NTP?)'),
  hr: z.number().optional(),
  spo2: z.number().optional(),
  temp: z.number().optional(),
  accPeakG: z.number().optional(),
  fall: z.boolean().optional(),
}) satisfies z.ZodType<TelemetryReading>;

export interface ParsedReading {
  reading: TelemetryReading;
  /** Mediciones fuera de `TELEMETRY_READING_LIMITS` que se sacaron (sensor sin poner o roto). */
  dropped: LimitedReadingField[];
}

/**
 * Valida la forma (lanza `TelemetryRejection`) y saca solo las mediciones fuera de rango: un
 * `temp` de 23 °C (pulsera sin poner) no puede tirar la lectura que trae `fall: true`.
 * Mismos rangos que `tools/scripts/mqtt-check.ts` (decisión del equipo, revisión del #13).
 */
export function parseReading(data: unknown): ParsedReading {
  const parsed = telemetryReadingSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || 'lectura'}: ${i.message}`);
    throw new TelemetryRejection(`lectura inválida (${issues.join('; ')})`);
  }
  return dropOutOfRangeFields(parsed.data);
}
