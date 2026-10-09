// Solo el test usa node:crypto: los vectores en sí son datos puros (ver AGENTS.md de la lib).
import { createCipheriv, createDecipheriv } from 'node:crypto';
import { GCM_TEST_VECTORS, type GcmTestVector } from './gcm-test-vectors';
import { parseWearableCode } from './wearable-id';

const hex = (s: string) => Buffer.from(s, 'hex');

function encrypt(v: GcmTestVector) {
  const cipher = createCipheriv('aes-256-gcm', hex(v.keyHex), hex(v.ivHex));
  const ct = Buffer.concat([cipher.update(hex(v.plaintextHex)), cipher.final()]);
  return { ct: ct.toString('hex'), tag: cipher.getAuthTag().toString('hex') };
}

function decrypt(key: Buffer, iv: Buffer, ct: Buffer, tag: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

describe('GCM_TEST_VECTORS', () => {
  it('tienen nombres únicos y válidos como identificador C', () => {
    const names = GCM_TEST_VECTORS.map((v) => v.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it.each(GCM_TEST_VECTORS.map((v) => [v.name, v] as const))(
    '%s: clave de 32 bytes, IV de 12 y tag de 16',
    (_, v) => {
      expect(hex(v.keyHex)).toHaveLength(32);
      expect(hex(v.ivHex)).toHaveLength(12);
      expect(hex(v.tagHex)).toHaveLength(16);
    },
  );

  it.each(GCM_TEST_VECTORS.filter((v) => v.expect === 'ok').map((v) => [v.name, v] as const))(
    '%s: cifrar da el ct y el tag esperados, y descifrar recupera el texto',
    (_, v) => {
      expect(encrypt(v)).toEqual({ ct: v.ctHex, tag: v.tagHex });
      expect(decrypt(hex(v.keyHex), hex(v.ivHex), hex(v.ctHex), hex(v.tagHex)).toString('hex')).toBe(
        v.plaintextHex,
      );
    },
  );

  it.each(GCM_TEST_VECTORS.filter((v) => v.expect === 'reject').map((v) => [v.name, v] as const))(
    '%s: el descifrado falla por tag inválido',
    (_, v) => {
      expect(() => decrypt(hex(v.keyHex), hex(v.ivHex), hex(v.ctHex), hex(v.tagHex))).toThrow();
    },
  );

  it('el sobre de vitalia_reading descifra a un TelemetryReading de un wearable válido', () => {
    const v = GCM_TEST_VECTORS.find((x) => x.name === 'vitalia_reading');
    const env = v?.envelope;
    if (!v || !env) throw new Error('falta el vector vitalia_reading con sobre');

    expect(env.v).toBe(1);
    const plain = decrypt(
      hex(v.keyHex),
      Buffer.from(env.iv, 'base64'),
      Buffer.from(env.ct, 'base64'),
      Buffer.from(env.tag, 'base64'),
    );
    const reading = JSON.parse(plain.toString('utf8'));
    expect(parseWearableCode(reading.wearableId)).toEqual({ number: 1, macSuffix: '24d7cc' });
    expect(reading).toMatchObject({ seq: 1, fall: false });
  });
});
