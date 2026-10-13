import { WEARABLE_NUMBER_MAX, WEARABLE_NUMBER_MIN } from '@vitalia/contracts';
import { ANOMALY_KINDS, type AnomalyKind } from './vitals';

/**
 * Eventos que no son clínicos: prueban la API ante reinicios y mensajes repetidos,
 * alterados o reinyectados en el tópico de otra pulsera (docs/04-contratos.md).
 */
export const EVENT_KINDS = ['reboot', 'duplicate', 'tamper', 'spoof'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export type InjectKind = AnomalyKind | EventKind;
export const INJECT_KINDS: readonly InjectKind[] = [...ANOMALY_KINDS, ...EVENT_KINDS];

export interface Injection {
  kind: InjectKind;
  /** Número de la pulsera (NN de `wb-NN-…`). */
  target: number;
  /** Momento desde el arranque del simulador. */
  atMs: number;
  /** Duración de una anomalía sostenida, o inmovilidad después de una caída. */
  durationMs: number;
}

export interface SimOptions {
  url: string;
  keyHex: string;
  username?: string;
  password?: string;
  count: number;
  first: number;
  room: string;
  intervalMs: number;
  /** 0 = hasta Ctrl+C. */
  durationMs: number;
  seed: number;
  injections: Injection[];
  verbose: boolean;
  help: boolean;
}

export const DEFAULTS = {
  url: 'mqtt://localhost:1883',
  /** wb-02…wb-08: las pulseras simuladas que trae el seed de la API. */
  count: 7,
  first: 2,
  room: 'sala1',
  intervalS: 3,
  anomalyS: 30,
} as const;

/** Última pulsera simulada que trae el seed de la API (`wb-08-5e0008`). */
export const LAST_SEEDED_NUMBER = 8;

export const USAGE = `Simulador de wearables Vitalia: publica lecturas cifradas (AES-256-GCM) por MQTT con QoS 1.

  pnpm sim:wearables [opciones]

Opciones:
  --count=N            pulseras simuladas (por defecto ${DEFAULTS.count}: wb-02…wb-08 del seed)
  --first=NN           número de la primera pulsera (por defecto ${DEFAULTS.first})
  --interval=S         segundos entre lecturas de cada pulsera (por defecto ${DEFAULTS.intervalS})
  --duration=S         termina después de S segundos (por defecto, hasta Ctrl+C)
  --room=SALA          sala del tópico (por defecto ${DEFAULTS.room})
  --seed=N             semilla: mismas lecturas en cada corrida
  --inject=ESPEC       inyecta un evento; se puede repetir (ver abajo)
  --url=URL            broker (por defecto MQTT_URL del .env o ${DEFAULTS.url})
  --key=HEX            clave AES de 64 hex (por defecto TELEMETRY_AES_KEY del .env)
  --verbose            muestra cada lectura publicada
  --help

ESPEC = <tipo>:<NN>[@<segundo>][~<duración s>]   ej. fall:3@10   hypoxia:4@5~60
  Clínicos: ${ANOMALY_KINDS.join(', ')} (duración por defecto ${DEFAULTS.anomalyS} s)
  Pruebas de la API: reboot (seq salta de bloque), duplicate (reenvía la última lectura),
    tamper (última lectura con el tag alterado), spoof (última lectura en el tópico de otra pulsera)

Con la terminal interactiva, escribí "<tipo> <NN> [duración s]" (ej. "fall 3") o "ayuda".`;

/** Error de uso: el mensaje se muestra junto con {@link USAGE}. */
export class UsageError extends Error {}

const SPEC = /^([a-z]+):(\d{1,2})(?:@(\d+(?:\.\d+)?))?(?:~(\d+(?:\.\d+)?))?$/;

/** `hypoxia:4@5~60` → hipoxia en la pulsera 04 a los 5 s, durante 60 s. */
export function parseInjection(spec: string): Injection {
  const match = SPEC.exec(spec.trim());
  if (!match)
    throw new UsageError(`--inject inválido: "${spec}" (formato <tipo>:<NN>[@<segundo>][~<duración s>])`);
  const kind = match[1] as InjectKind;
  if (!INJECT_KINDS.includes(kind)) {
    throw new UsageError(`tipo de evento desconocido: "${match[1]}" (válidos: ${INJECT_KINDS.join(', ')})`);
  }
  return {
    kind,
    target: Number(match[2]),
    atMs: Math.round(Number(match[3] ?? 0) * 1000),
    durationMs: Math.round(Number(match[4] ?? DEFAULTS.anomalyS) * 1000),
  };
}

/** Lanza {@link UsageError} si la pulsera no está entre las simuladas o el evento no se puede aplicar. */
export function validateTarget(injection: Injection, first: number, count: number): void {
  const last = first + count - 1;
  if (injection.target < first || injection.target > last) {
    throw new UsageError(`la pulsera ${injection.target} no está simulada (son de la ${first} a la ${last})`);
  }
  if (injection.kind === 'spoof' && count < 2) {
    throw new UsageError('spoof necesita al menos 2 pulseras simuladas');
  }
}

function positiveNumber(raw: string, name: string, { integer = false, allowZero = false } = {}): number {
  const n = Number(raw);
  const ok = Number.isFinite(n) && (allowZero ? n >= 0 : n > 0) && (!integer || Number.isInteger(n));
  if (!ok) throw new UsageError(`--${name}=${raw} no es válido`);
  return n;
}

export function parseOptions(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): SimOptions {
  const values = new Map<string, string>();
  const injections: Injection[] = [];
  let verbose = false;
  let help = false;

  for (const arg of argv) {
    if (arg === '--') continue; // pnpm lo agrega a veces antes de los argumentos del script
    if (arg === '--verbose') verbose = true;
    else if (arg === '--help' || arg === '-h') help = true;
    else {
      const match = /^--([a-z]+)=(.*)$/.exec(arg);
      if (!match) throw new UsageError(`argumento desconocido: ${arg}`);
      if (match[1] === 'inject') injections.push(parseInjection(match[2]));
      else values.set(match[1], match[2]);
    }
  }

  const known = new Set(['url', 'key', 'count', 'first', 'interval', 'duration', 'room', 'seed']);
  for (const name of values.keys()) {
    if (!known.has(name)) throw new UsageError(`opción desconocida: --${name}`);
  }

  const get = (name: string) => values.get(name);
  const count = positiveNumber(get('count') ?? String(DEFAULTS.count), 'count', { integer: true });
  const first = positiveNumber(get('first') ?? String(DEFAULTS.first), 'first', { integer: true });
  if (first < WEARABLE_NUMBER_MIN || first + count - 1 > WEARABLE_NUMBER_MAX) {
    throw new UsageError(
      `las pulseras van de ${WEARABLE_NUMBER_MIN} a ${WEARABLE_NUMBER_MAX}: --first=${first} y --count=${count} se pasan`,
    );
  }
  for (const injection of injections) validateTarget(injection, first, count);

  const room = get('room') ?? DEFAULTS.room;
  if (!/^[a-z0-9_-]+$/i.test(room)) throw new UsageError(`--room=${room}: sin "/", "+" ni "#"`);

  const keyHex = get('key') ?? env['TELEMETRY_AES_KEY'] ?? '';
  if (!help && !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new UsageError('falta la clave: TELEMETRY_AES_KEY en el .env (64 hex) o --key=<64 hex>');
  }

  return {
    url: get('url') ?? env['MQTT_URL'] ?? DEFAULTS.url,
    keyHex,
    username: env['MQTT_USERNAME'] || undefined,
    password: env['MQTT_PASSWORD'] || undefined,
    count,
    first,
    room,
    intervalMs: Math.round(positiveNumber(get('interval') ?? String(DEFAULTS.intervalS), 'interval') * 1000),
    durationMs: Math.round(positiveNumber(get('duration') ?? '0', 'duration', { allowZero: true }) * 1000),
    seed:
      get('seed') !== undefined
        ? positiveNumber(get('seed') as string, 'seed', { integer: true, allowZero: true })
        : Date.now() % 2 ** 31,
    injections,
    verbose,
    help,
  };
}
