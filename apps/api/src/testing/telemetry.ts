/**
 * Utilidades SOLO para tests: arman sobres como los publica el wearable.
 * (El build de la API no las incluye: nada fuera de los *.spec.ts las importa.)
 */
import { ENVELOPE_VERSION, TELEMETRY_CIPHER, type TelemetryReading } from '@vitalia/contracts';
import { createCipheriv, randomBytes } from 'node:crypto';

export function sealEnvelope(
  plaintext: object | string,
  key: Buffer,
  iv = randomBytes(TELEMETRY_CIPHER.ivBytes),
) {
  const cipher = createCipheriv(TELEMETRY_CIPHER.algorithm, key, iv);
  const json = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  const ct = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  return {
    v: ENVELOPE_VERSION,
    iv: iv.toString('base64'),
    ct: ct.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function sealReading(reading: TelemetryReading, key: Buffer): Buffer {
  return Buffer.from(JSON.stringify(sealEnvelope(reading, key)));
}
