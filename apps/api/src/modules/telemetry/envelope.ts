import { ENVELOPE_VERSION, TELEMETRY_CIPHER } from '@vitalia/contracts';
import { createDecipheriv } from 'node:crypto';
import { TelemetryRejection } from './telemetry-rejection';

/** Base64 estricto (rechaza basura que `Buffer.from` aceptaría en silencio) con largo opcional. */
function b64(value: unknown, field: string, bytes?: number): Buffer {
  if (typeof value !== 'string') throw new TelemetryRejection(`sobre: "${field}" no es string`);
  const buf = Buffer.from(value, 'base64');
  if (buf.toString('base64') !== value) throw new TelemetryRejection(`sobre: "${field}" no es base64 válido`);
  if (bytes !== undefined && buf.length !== bytes) {
    throw new TelemetryRejection(`sobre: "${field}" mide ${buf.length} bytes (esperado ${bytes})`);
  }
  return buf;
}

/**
 * AES-256-GCM sin AAD (ADR 0006). Lanza si el tag no valida (clave distinta o mensaje alterado).
 * Se prueba con `GCM_TEST_VECTORS` de `@vitalia/contracts/testing`.
 */
export function decryptGcm(key: Buffer, iv: Buffer, ct: Buffer, tag: Buffer): Buffer {
  const decipher = createDecipheriv(TELEMETRY_CIPHER.algorithm, key, iv, {
    authTagLength: TELEMETRY_CIPHER.tagBytes,
  });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/**
 * Abre un `EncryptedEnvelope` publicado por el wearable y devuelve el JSON descifrado,
 * todavía sin validar (eso lo hace `parseReading`). Misma lógica que `tools/scripts/mqtt-check.ts`.
 */
export function openEnvelope(raw: Buffer, key: Buffer): unknown {
  let env: Record<string, unknown>;
  try {
    env = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new TelemetryRejection('no es JSON (¿lectura en claro en el tópico de datos?)');
  }
  if (typeof env !== 'object' || env === null) throw new TelemetryRejection('el sobre no es un objeto');
  if (env['v'] !== ENVELOPE_VERSION) {
    throw new TelemetryRejection(`sobre: v=${String(env['v'])} (esperado ${ENVELOPE_VERSION})`);
  }
  const iv = b64(env['iv'], 'iv', TELEMETRY_CIPHER.ivBytes);
  const ct = b64(env['ct'], 'ct');
  const tag = b64(env['tag'], 'tag', TELEMETRY_CIPHER.tagBytes);

  let plain: Buffer;
  try {
    plain = decryptGcm(key, iv, ct, tag);
  } catch {
    throw new TelemetryRejection('el tag no valida: clave distinta o mensaje alterado');
  }
  try {
    return JSON.parse(plain.toString('utf8'));
  } catch {
    throw new TelemetryRejection('el contenido descifrado no es JSON');
  }
}
