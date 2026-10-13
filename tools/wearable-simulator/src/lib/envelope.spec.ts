import { TELEMETRY_CIPHER, type TelemetryReading } from '@vitalia/contracts';
import { GCM_TEST_VECTORS } from '@vitalia/contracts/testing';
import { openEnvelope, parseKey, sealPlaintext, sealReading, tamperEnvelope } from './envelope';

const vector = GCM_TEST_VECTORS.find((v) => v.name === 'vitalia_reading');
if (!vector?.envelope) throw new Error('falta el vector vitalia_reading en contracts');
const key = parseKey(vector.keyHex);
const reading = JSON.parse(Buffer.from(vector.plaintextHex, 'hex').toString('utf8')) as TelemetryReading;

describe('envelope', () => {
  it('produce el mismo sobre que el vector compartido con la API y el firmware', () => {
    const iv = Buffer.from(vector.ivHex, 'hex');
    expect(sealReading(reading, key, iv)).toEqual(vector.envelope);
    expect(sealPlaintext(Buffer.from(vector.plaintextHex, 'hex').toString('utf8'), key, iv)).toEqual(
      vector.envelope,
    );
  });

  it('cifra con IV aleatorio de 12 bytes y tag de 16, y se puede abrir', () => {
    const a = sealReading(reading, key);
    const b = sealReading(reading, key);
    expect(Buffer.from(a.iv, 'base64')).toHaveLength(TELEMETRY_CIPHER.ivBytes);
    expect(Buffer.from(a.tag, 'base64')).toHaveLength(TELEMETRY_CIPHER.tagBytes);
    expect(a.iv).not.toBe(b.iv);
    expect(openEnvelope(a, key)).toEqual(reading);
  });

  it('un sobre alterado no valida', () => {
    const tampered = tamperEnvelope(sealReading(reading, key));
    expect(() => openEnvelope(tampered, key)).toThrow();
  });

  it('rechaza claves que no son de 64 hex', () => {
    expect(() => parseKey('abc')).toThrow(/64 caracteres hex/);
    expect(() => parseKey('z'.repeat(64))).toThrow();
  });
});
