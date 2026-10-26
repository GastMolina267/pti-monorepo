/**
 * Verificador de telemetría: se suscribe a Mosquitto, descifra cada sobre y valida la
 * lectura contra @vitalia/contracts. Sirve para probar el firmware sin la API y como
 * referencia del descifrado para el módulo `telemetry` (docs/04-contratos.md).
 *
 *   pnpm fw:mqtt-check                          # usa MQTT_URL y TELEMETRY_AES_KEY del .env
 *   pnpm fw:mqtt-check --url=mqtt://192.168.0.100:1883 --key=<64 hex>
 *   pnpm fw:mqtt-check --count=5                # sale después de 5 mensajes (exit 1 si hubo errores)
 */
import { createDecipheriv } from 'node:crypto';
import mqtt from 'mqtt';
import {
  ENVELOPE_VERSION,
  MQTT_QOS,
  MQTT_TOPICS,
  TELEMETRY_CIPHER,
  TELEMETRY_READING_LIMITS,
  dropOutOfRangeFields,
  type EncryptedEnvelope,
  type LimitedReadingField,
  type TelemetryReading,
} from '../../libs/shared/contracts/src/lib/telemetry/mqtt';
import { splitSeq } from '../../libs/shared/contracts/src/lib/telemetry/seq';
import { parseWearableCode } from '../../libs/shared/contracts/src/lib/telemetry/wearable-id';

try {
  process.loadEnvFile('.env');
} catch {
  // sin .env: se usan los argumentos o los valores por defecto
}

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const url = arg('url') ?? process.env['MQTT_URL'] ?? 'mqtt://localhost:1883';
const keyHex = arg('key') ?? process.env['TELEMETRY_AES_KEY'] ?? '';
const maxCount = Number(arg('count') ?? 0);

if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
  console.error('✖ Falta la clave: TELEMETRY_AES_KEY en el .env (64 hex) o --key=<64 hex>.');
  process.exit(2);
}
const key = Buffer.from(keyHex, 'hex');

/** Último seq visto por wearable, para detectar duplicados, pérdidas y reinicios. */
const lastSeq = new Map<string, number>();
const MIN_TS_MS = Date.UTC(2024, 0, 1);
const MAX_SKEW_MS = 5 * 60_000;
const KNOWN_FIELDS = new Set(['wearableId', 'seq', 'ts', 'hr', 'spo2', 'temp', 'accPeakG', 'fall']);

class Invalid extends Error {}

function b64(value: unknown, field: string, bytes?: number): Buffer {
  if (typeof value !== 'string') throw new Invalid(`sobre: "${field}" no es string`);
  const buf = Buffer.from(value, 'base64');
  if (buf.toString('base64') !== value) throw new Invalid(`sobre: "${field}" no es base64 válido`);
  if (bytes !== undefined && buf.length !== bytes) {
    throw new Invalid(`sobre: "${field}" mide ${buf.length} bytes (esperado ${bytes})`);
  }
  return buf;
}

function decrypt(raw: Buffer): TelemetryReading {
  let env: EncryptedEnvelope;
  try {
    env = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new Invalid('no es JSON (¿lectura en claro en el tópico de datos?)');
  }
  if (env.v !== ENVELOPE_VERSION) throw new Invalid(`sobre: v=${env.v} (esperado ${ENVELOPE_VERSION})`);
  const iv = b64(env.iv, 'iv', TELEMETRY_CIPHER.ivBytes);
  const ct = b64(env.ct, 'ct');
  const tag = b64(env.tag, 'tag', TELEMETRY_CIPHER.tagBytes);
  try {
    const decipher = createDecipheriv(TELEMETRY_CIPHER.algorithm, key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(plain.toString('utf8'));
  } catch {
    throw new Invalid('el tag no valida: clave distinta o mensaje alterado → se descarta');
  }
}

// Como la API: un tipo equivocado descarta el mensaje; un valor fuera de rango, solo ese campo.
function checkMeasurements(r: TelemetryReading, warnings: string[]) {
  for (const field of Object.keys(TELEMETRY_READING_LIMITS) as LimitedReadingField[]) {
    const v = r[field];
    if (v !== undefined && typeof v !== 'number')
      throw new Invalid(`${field}=${JSON.stringify(v)} no es número`);
  }
  for (const field of dropOutOfRangeFields(r).dropped) {
    const { min, max } = TELEMETRY_READING_LIMITS[field];
    warnings.push(`${field}=${r[field]} fuera de ${min}–${max}: la API descarta solo ese campo`);
  }
}

function validate(topic: string, r: TelemetryReading): string[] {
  const warnings: string[] = [];
  const topicId = topic.split('/')[3];
  if (!parseWearableCode(r.wearableId)) throw new Invalid(`wearableId "${r.wearableId}" no es wb-<NN>-<mac>`);
  // Regla de seguridad (revisión del PR #3): sin AAD y con clave compartida, un sobre válido
  // de una pulsera reinyectado en el tópico de otra tiene que descartarse.
  if (r.wearableId !== topicId) {
    throw new Invalid(`wearableId "${r.wearableId}" ≠ tópico "${topicId}" → se descarta`);
  }
  const unknown = Object.keys(r).filter((k) => !KNOWN_FIELDS.has(k));
  if (unknown.length > 0) throw new Invalid(`campos fuera del contrato: ${unknown.join(', ')}`);
  if (!Number.isSafeInteger(r.seq) || r.seq < 0) throw new Invalid(`seq=${r.seq} no es entero ≥ 0`);
  // Entero, igual que la API (`z.number().int()`): un ts con decimales descarta el mensaje.
  if (!Number.isSafeInteger(r.ts) || r.ts < MIN_TS_MS) {
    throw new Invalid(`ts=${r.ts}: no es epoch en ms (¿segundos? ¿reloj sin NTP?)`);
  }
  if (Math.abs(Date.now() - r.ts) > MAX_SKEW_MS) {
    warnings.push(`ts desfasado ${Math.round((Date.now() - r.ts) / 1000)} s`);
  }
  checkMeasurements(r, warnings);
  if (r.fall !== undefined && typeof r.fall !== 'boolean') throw new Invalid('fall no es boolean');

  const prev = lastSeq.get(r.wearableId);
  if (prev !== undefined) {
    const before = splitSeq(prev);
    const now = splitSeq(r.seq);
    if (r.seq === prev) warnings.push('seq repetido (reenvío de QoS 1: la API lo deduplica)');
    else if (r.seq < prev) warnings.push(`seq retrocedió (${prev} → ${r.seq})`);
    else if (now.boot > before.boot)
      warnings.push(`reinicio del wearable (arranque ${before.boot} → ${now.boot})`);
    else if (now.counter > before.counter + 1)
      warnings.push(`${now.counter - before.counter - 1} lecturas perdidas`);
  }
  if (prev === undefined || r.seq > prev) lastSeq.set(r.wearableId, r.seq);
  return warnings;
}

function describe(r: TelemetryReading): string {
  const { boot, counter } = splitSeq(r.seq);
  const parts = [`seq ${boot}:${counter}`, new Date(r.ts).toLocaleTimeString()];
  if (r.temp !== undefined) parts.push(`${r.temp} °C`);
  if (r.hr !== undefined) parts.push(`${r.hr} lpm`);
  if (r.spo2 !== undefined) parts.push(`SpO₂ ${r.spo2} %`);
  if (r.accPeakG !== undefined) parts.push(`pico ${r.accPeakG} g`);
  if (r.fall) parts.push('CAÍDA');
  return parts.join(' · ');
}

let seen = 0;
let errors = 0;
const client = mqtt.connect(url, {
  username: process.env['MQTT_USERNAME'] || undefined,
  password: process.env['MQTT_PASSWORD'] || undefined,
  reconnectPeriod: 2000,
});

client.on('connect', () => {
  client.subscribe(MQTT_TOPICS.allWearableData, { qos: MQTT_QOS });
  console.log(`Escuchando ${MQTT_TOPICS.allWearableData} en ${url} (Ctrl+C para salir)`);
});
client.on('error', (err) => console.error(`MQTT: ${err.message}`));

client.on('message', (topic, payload) => {
  seen++;
  const stamp = new Date().toLocaleTimeString();
  try {
    const reading = decrypt(payload);
    const warnings = validate(topic, reading);
    console.log(`✔ ${stamp} ${reading.wearableId} · ${describe(reading)}`);
    for (const w of warnings) console.log(`  ⚠ ${w}`);
  } catch (err) {
    if (!(err instanceof Invalid)) throw err;
    errors++;
    console.log(`✖ ${stamp} ${topic}: ${err.message}`);
  }
  if (maxCount > 0 && seen >= maxCount) {
    client.end();
    console.log(`${seen} mensajes, ${errors} inválidos.`);
    process.exit(errors > 0 ? 1 : 0);
  }
});
