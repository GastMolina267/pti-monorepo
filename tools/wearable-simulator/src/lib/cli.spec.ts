import { DEFAULTS, UsageError, parseInjection, parseOptions, validateTarget } from './cli';

const KEY = 'ab'.repeat(32);
const env = { TELEMETRY_AES_KEY: KEY, MQTT_URL: 'mqtt://gateway:1883' };

describe('parseInjection', () => {
  it('lee tipo, pulsera, segundo y duración', () => {
    expect(parseInjection('hypoxia:4@5~60')).toEqual({
      kind: 'hypoxia',
      target: 4,
      atMs: 5000,
      durationMs: 60000,
    });
  });

  it('por defecto arranca enseguida y dura lo estándar', () => {
    expect(parseInjection('fall:3')).toEqual({
      kind: 'fall',
      target: 3,
      atMs: 0,
      durationMs: DEFAULTS.anomalyS * 1000,
    });
  });

  it('acepta los eventos de prueba de la API', () => {
    for (const kind of ['reboot', 'duplicate', 'tamper', 'spoof']) {
      expect(parseInjection(`${kind}:2@1.5`)).toMatchObject({ kind, atMs: 1500 });
    }
  });

  it.each(['caida:3', 'fall', 'fall:3@x', 'fall:123', ''])('rechaza "%s"', (spec) => {
    expect(() => parseInjection(spec)).toThrow(UsageError);
  });
});

describe('validateTarget', () => {
  it('la pulsera tiene que estar entre las simuladas', () => {
    expect(() => validateTarget(parseInjection('fall:8'), 2, 7)).not.toThrow();
    expect(() => validateTarget(parseInjection('fall:9'), 2, 7)).toThrow(/no está simulada/);
    expect(() => validateTarget(parseInjection('fall:1'), 2, 7)).toThrow(UsageError);
  });

  it('spoof necesita otra pulsera', () => {
    expect(() => validateTarget(parseInjection('spoof:2'), 2, 1)).toThrow(/al menos 2/);
  });
});

describe('parseOptions', () => {
  it('por defecto simula las pulseras del seed cada 3 s con el .env', () => {
    const o = parseOptions([], env);
    expect(o).toMatchObject({
      url: 'mqtt://gateway:1883',
      keyHex: KEY,
      count: 7,
      first: 2,
      room: 'sala1',
      intervalMs: 3000,
      durationMs: 0,
      injections: [],
      verbose: false,
    });
  });

  it('los argumentos ganan sobre el .env', () => {
    const o = parseOptions(
      [
        '--',
        '--count=50',
        '--interval=1.5',
        '--duration=600',
        '--url=mqtt://x',
        '--seed=42',
        '--inject=fall:10@5',
        '--verbose',
      ],
      env,
    );
    expect(o).toMatchObject({
      count: 50,
      intervalMs: 1500,
      durationMs: 600000,
      url: 'mqtt://x',
      seed: 42,
      verbose: true,
    });
    expect(o.injections).toHaveLength(1);
  });

  it('no se pasa de la pulsera 99', () => {
    expect(() => parseOptions(['--count=98'], env)).not.toThrow();
    expect(() => parseOptions(['--count=99'], env)).toThrow(/se pasan/);
  });

  it('exige una clave de 64 hex', () => {
    expect(() => parseOptions([], {})).toThrow(/TELEMETRY_AES_KEY/);
    expect(() => parseOptions(['--key=123'], {})).toThrow(UsageError);
    expect(parseOptions(['--help'], {}).help).toBe(true);
  });

  it.each(['--count=0', '--count=2.5', '--interval=-1', '--colors=on', 'fall:3', '--room=sala/1'])(
    'rechaza %s',
    (arg) => {
      expect(() => parseOptions([arg], env)).toThrow(UsageError);
    },
  );

  it('valida las inyecciones contra las pulseras simuladas', () => {
    expect(() => parseOptions(['--inject=fall:20'], env)).toThrow(/no está simulada/);
  });
});
