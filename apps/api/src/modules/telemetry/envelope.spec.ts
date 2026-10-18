import { GCM_TEST_VECTORS } from '@vitalia/contracts/testing';
import { randomBytes } from 'node:crypto';
import { sealEnvelope } from '../../testing/telemetry';
import { decryptGcm, openEnvelope } from './envelope';
import { TelemetryRejection } from './telemetry-rejection';

const hex = (h: string) => Buffer.from(h, 'hex');
const vector = (name: string) => {
  const v = GCM_TEST_VECTORS.find((x) => x.name === name);
  if (!v) throw new Error(`Falta el vector ${name}`);
  return v;
};

describe('decryptGcm (vectores compartidos con el firmware)', () => {
  it.each(GCM_TEST_VECTORS.map((v) => [v.name, v] as const))('%s', (_name, v) => {
    const run = () => decryptGcm(hex(v.keyHex), hex(v.ivHex), hex(v.ctHex), hex(v.tagHex));
    if (v.expect === 'ok') expect(run().toString('hex')).toBe(v.plaintextHex);
    else expect(run).toThrow();
  });
});

describe('openEnvelope', () => {
  const v = vector('vitalia_reading');
  const key = hex(v.keyHex);
  const raw = (o: unknown) => Buffer.from(JSON.stringify(o));

  it('abre el sobre de vitalia_reading tal como lo publica el wearable', () => {
    expect(openEnvelope(raw(v.envelope), key)).toEqual(JSON.parse(hex(v.plaintextHex).toString('utf8')));
  });

  it('descarta el sobre con el tag alterado', () => {
    const bad = vector('vitalia_reading_bad_tag');
    const envelope = { ...v.envelope, tag: hex(bad.tagHex).toString('base64') };
    expect(() => openEnvelope(raw(envelope), key)).toThrow(/tag no valida/);
  });

  it('descarta el sobre cifrado con otra clave', () => {
    expect(() => openEnvelope(raw(v.envelope), randomBytes(32))).toThrow(TelemetryRejection);
  });

  it.each([
    ['texto en claro', Buffer.from('{"wearableId":'), /no es JSON/],
    ['otra versión', raw({ ...v.envelope, v: 2 }), /v=2/],
    ['IV de otro largo', raw({ ...v.envelope, iv: Buffer.alloc(16).toString('base64') }), /"iv" mide 16/],
    ['base64 inválido', raw({ ...v.envelope, ct: '¡no!' }), /"ct" no es base64/],
    ['tag ausente', raw({ v: 1, iv: v.envelope?.iv, ct: v.envelope?.ct }), /"tag" no es string/],
  ])('rechaza %s', (_case, payload, message) => {
    expect(() => openEnvelope(payload, key)).toThrow(message);
  });

  it('rechaza un contenido descifrado que no es JSON', () => {
    const k = randomBytes(32);
    expect(() => openEnvelope(raw(sealEnvelope('no-json', k)), k)).toThrow(/no es JSON/);
  });
});
