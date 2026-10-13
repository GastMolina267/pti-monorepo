import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import {
  ENVELOPE_VERSION,
  TELEMETRY_CIPHER,
  type EncryptedEnvelope,
  type TelemetryReading,
} from '@vitalia/contracts';

/** Clave de 64 hex (`TELEMETRY_AES_KEY`) → 32 bytes. Lanza si el formato no es válido. */
export function parseKey(hex: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('la clave tiene que ser de 64 caracteres hex (TELEMETRY_AES_KEY)');
  }
  return Buffer.from(hex, 'hex');
}

/** Cifra un texto con AES-256-GCM, igual que `crypto::seal` del firmware (IV aleatorio, sin AAD). */
export function sealPlaintext(
  plaintext: string,
  key: Buffer,
  iv: Buffer = randomBytes(TELEMETRY_CIPHER.ivBytes),
): EncryptedEnvelope {
  const cipher = createCipheriv(TELEMETRY_CIPHER.algorithm, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    v: ENVELOPE_VERSION,
    iv: iv.toString('base64'),
    ct: ct.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function sealReading(reading: TelemetryReading, key: Buffer, iv?: Buffer): EncryptedEnvelope {
  return sealPlaintext(JSON.stringify(reading), key, iv);
}

/** Inversa de {@link sealReading}. Lanza si el tag no valida. Solo para tests y diagnóstico. */
export function openEnvelope(envelope: EncryptedEnvelope, key: Buffer): TelemetryReading {
  const decipher = createDecipheriv(TELEMETRY_CIPHER.algorithm, key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(envelope.ct, 'base64')), decipher.final()]);
  return JSON.parse(plain.toString('utf8')) as TelemetryReading;
}

/** Copia del sobre con el último byte del tag alterado: el gateway lo tiene que descartar. */
export function tamperEnvelope(envelope: EncryptedEnvelope): EncryptedEnvelope {
  const tag = Buffer.from(envelope.tag, 'base64');
  tag[tag.length - 1] ^= 0x01;
  return { ...envelope, tag: tag.toString('base64') };
}
