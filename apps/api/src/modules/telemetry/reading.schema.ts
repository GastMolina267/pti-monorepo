import { WEARABLE_CODE_PATTERN, type TelemetryReading } from '@vitalia/contracts';
import { z } from 'zod';
import { TelemetryRejection } from './telemetry-rejection';

/** Un `ts` anterior a 2024 es un reloj sin NTP o un epoch en segundos. */
export const MIN_READING_TS_MS = Date.UTC(2024, 0, 1);

/**
 * Validación del `TelemetryReading` descifrado. Rangos físicamente posibles (no clínicos:
 * la clasificación la hace `assessVitals`), los mismos que `tools/scripts/mqtt-check.ts`.
 * Estricto: un campo fuera del contrato descarta el mensaje.
 */
export const telemetryReadingSchema = z.strictObject({
  wearableId: z.string().regex(WEARABLE_CODE_PATTERN, 'no es wb-<NN>-<mac>'),
  seq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  ts: z.number().int().min(MIN_READING_TS_MS, 'no es epoch en ms (¿segundos? ¿reloj sin NTP?)'),
  hr: z.number().min(20).max(250).optional(),
  spo2: z.number().min(50).max(100).optional(),
  temp: z.number().min(25).max(45).optional(),
  accPeakG: z.number().min(0).max(16).optional(),
  fall: z.boolean().optional(),
}) satisfies z.ZodType<TelemetryReading>;

export function parseReading(data: unknown): TelemetryReading {
  const parsed = telemetryReadingSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || 'lectura'}: ${i.message}`);
    throw new TelemetryRejection(`lectura inválida (${issues.join('; ')})`);
  }
  return parsed.data;
}
