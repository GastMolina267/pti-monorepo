/**
 * Simulador de wearables: N pulseras que publican lecturas del contrato cifradas con
 * AES-256-GCM por MQTT (QoS 1), igual que el firmware. Sirve para desarrollar la API y el
 * Backoffice sin hardware, para la demo y para las pruebas de carga y latencia de la Fase 5.
 *
 *   pnpm sim:wearables                                  # wb-02…wb-08 cada 3 s (las del seed)
 *   pnpm sim:wearables --count=50 --duration=600        # prueba de carga
 *   pnpm sim:wearables --inject=fall:3@10 --inject=hypoxia:4@20~60
 *
 * Cada pulsera tiene su propia conexión con el client ID = su código, como el firmware.
 * `pnpm sim:wearables --help` muestra todas las opciones.
 */
import { createInterface } from 'node:readline';
import mqtt, { type MqttClient } from 'mqtt';
import {
  MQTT_QOS,
  assessVitals,
  splitSeq,
  type EncryptedEnvelope,
  type TelemetryReading,
  type TriageLevel,
} from '@vitalia/contracts';
import {
  LAST_SEEDED_NUMBER,
  USAGE,
  UsageError,
  parseInjection,
  parseOptions,
  validateTarget,
  type Injection,
  type SimOptions,
} from './lib/cli';
import { parseKey, sealReading, tamperEnvelope } from './lib/envelope';
import { createRng } from './lib/rng';
import { BootStore } from './lib/boot-store';
import { SimulatedWearable, nextBoot } from './lib/wearable';

interface Sim {
  wearable: SimulatedWearable;
  client: MqttClient;
  level: TriageLevel;
  /** Último sobre publicado: lo reusan duplicate, tamper y spoof (un mensaje "capturado"). */
  lastEnvelope?: EncryptedEnvelope;
}

const LEVEL_ES: Record<TriageLevel, string> = {
  STABLE: 'ESTABLE',
  ATTENTION: 'ATENCIÓN',
  CRITICAL: 'CRÍTICO',
};
const STATS_EVERY_MS = 10_000;

const stamp = () => new Date().toLocaleTimeString();
const log = (message: string) => console.log(`[${stamp()}] ${message}`);
const seqText = (seq: number) => {
  const { boot, counter } = splitSeq(seq);
  return `${boot}:${counter}`;
};

function loadOptions(): SimOptions {
  try {
    process.loadEnvFile('.env');
  } catch {
    // sin .env: se usan los argumentos o los valores por defecto
  }
  try {
    const options = parseOptions(process.argv.slice(2), process.env);
    if (options.help) {
      console.log(USAGE);
      process.exit(0);
    }
    return options;
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    console.error(`✖ ${err.message}\n\n${USAGE}`);
    process.exit(2);
  }
}

const options = loadOptions();
const key = parseKey(options.keyHex);
const rng = createRng(options.seed);
// Como el contador de arranques en NVS del firmware: cada corrida usa un bloque de seq nuevo.
const bootStore = new BootStore();
const boot = nextBoot(Date.now(), bootStore.load());
bootStore.save(boot);
const stats = { published: 0, acked: 0, failed: 0 };
const timers: NodeJS.Timeout[] = [];

const sims: Sim[] = Array.from({ length: options.count }, (_, i) => {
  const wearable = new SimulatedWearable(options.first + i, options.room, rng, boot);
  const client = mqtt.connect(options.url, {
    clientId: wearable.code,
    username: options.username,
    password: options.password,
    reconnectPeriod: 2000,
  });
  client.on('error', (err) => log(`✖ ${wearable.code}: ${err.message}`));
  return { wearable, client, level: 'STABLE' };
});
const byNumber = new Map(sims.map((sim) => [sim.wearable.number, sim]));

function publish(sim: Sim, envelope: EncryptedEnvelope, topic = sim.wearable.topic): void {
  stats.published++;
  sim.client.publish(topic, JSON.stringify(envelope), { qos: MQTT_QOS }, (err) => {
    if (err) {
      stats.failed++;
      log(`✖ ${sim.wearable.code}: no se pudo publicar (${err.message})`);
    } else {
      stats.acked++;
    }
  });
}

function describe(r: TelemetryReading): string {
  return `seq ${seqText(r.seq)} · ${r.hr} lpm · SpO₂ ${r.spo2} % · ${r.temp} °C · pico ${r.accPeakG} g`;
}

function publishReading(sim: Sim): void {
  const reading = sim.wearable.nextReading(Date.now());
  const envelope = sealReading(reading, key);
  sim.lastEnvelope = envelope;
  publish(sim, envelope);

  const { level, reasons } = assessVitals(reading);
  if (reading.fall) {
    // ts sirve para medir la latencia de la alerta (Fase 5): emisión → Backoffice.
    log(`✱ ${sim.wearable.code} CAÍDA publicada · seq ${seqText(reading.seq)} · ts ${reading.ts}`);
  }
  if (level !== sim.level) {
    log(
      `${sim.wearable.code}: ${LEVEL_ES[sim.level]} → ${LEVEL_ES[level]}${reasons.length ? ` (${reasons.join('; ')})` : ''}`,
    );
    sim.level = level;
  } else if (options.verbose) {
    log(`${sim.wearable.code} · ${describe(reading)}`);
  }
}

function apply(injection: Injection): void {
  const sim = byNumber.get(injection.target);
  if (!sim) return;
  const { code } = sim.wearable;
  const seconds = Math.round(injection.durationMs / 1000);

  switch (injection.kind) {
    case 'reboot':
      bootStore.save(sim.wearable.reboot());
      log(`↻ ${code}: reinicio (el próximo seq salta de bloque)`);
      return;
    case 'duplicate':
    case 'tamper':
    case 'spoof': {
      if (!sim.lastEnvelope) {
        log(`⚠ ${code}: todavía no publicó nada para ${injection.kind}`);
        return;
      }
      if (injection.kind === 'duplicate') {
        publish(sim, sim.lastEnvelope);
        log(`⧉ ${code}: reenvío de la última lectura (la API la tiene que deduplicar)`);
      } else if (injection.kind === 'tamper') {
        publish(sim, tamperEnvelope(sim.lastEnvelope));
        log(`⚠ ${code}: lectura con el tag alterado (la API la tiene que descartar)`);
      } else {
        const victim = sims[(sims.indexOf(sim) + 1) % sims.length];
        publish(victim, sim.lastEnvelope);
        log(
          `⚠ ${code}: su última lectura, publicada en el tópico de ${victim.wearable.code} (la API la tiene que descartar)`,
        );
      }
      return;
    }
    case 'fall':
      sim.wearable.inject('fall', Date.now(), injection.durationMs);
      log(`↓ ${code}: caída (inmóvil ${seconds} s)`);
      publishReading(sim); // como el firmware: una caída se publica sin esperar el ciclo
      return;
    default:
      sim.wearable.inject(injection.kind, Date.now(), injection.durationMs);
      log(`! ${code}: ${injection.kind} durante ${seconds} s`);
  }
}

function printStats(final = false): void {
  const connected = sims.filter((s) => s.client.connected).length;
  log(
    `${final ? 'Fin: ' : ''}${sims.length} pulseras${final ? '' : ` · conectadas ${connected}/${sims.length}`} · ` +
      `publicadas ${stats.published} · confirmadas ${stats.acked} · fallidas ${stats.failed}`,
  );
}

let stopping = false;
async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  timers.forEach((t) => clearTimeout(t));
  // end(false) espera los PUBACK pendientes; si el broker no responde, se corta a los 5 s.
  const ended = Promise.all(
    sims.map((s) => new Promise<void>((resolve) => s.client.end(false, {}, () => resolve()))),
  );
  await Promise.race([ended, new Promise((resolve) => setTimeout(resolve, 5000))]);
  printStats(true);
  const pending = stats.published - stats.acked - stats.failed;
  if (pending > 0) log(`⚠ ${pending} lecturas sin confirmar (PUBACK) al cerrar`);
  process.exit(stats.failed > 0 || pending > 0 ? 1 : 0);
}

function startConsole(): void {
  if (!process.stdin.isTTY) return;
  const rl = createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    const [kind, nn, duration] = line.trim().split(/\s+/);
    if (!kind) return;
    if (kind === 'ayuda' || kind === 'help') {
      console.log(USAGE);
      return;
    }
    if (kind === 'estado') {
      printStats();
      for (const sim of sims) {
        const active = sim.wearable.activeAnomaly(Date.now());
        console.log(`  ${sim.wearable.code}  ${LEVEL_ES[sim.level]}${active ? `  (${active})` : ''}`);
      }
      return;
    }
    try {
      const injection = parseInjection(`${kind}:${nn ?? ''}${duration ? `~${duration}` : ''}`);
      validateTarget(injection, options.first, options.count);
      apply(injection);
    } catch (err) {
      if (!(err instanceof UsageError)) throw err;
      console.log(`✖ ${err.message}`);
    }
  });
}

// ---------------- Arranque ----------------
const last = options.first + options.count - 1;
log(
  `${options.count} pulseras (${sims[0].wearable.code} … ${sims[sims.length - 1].wearable.code}) → ${options.url}, ` +
    `cada ${options.intervalMs / 1000} s · sala ${options.room} · arranque ${boot} · semilla ${options.seed}`,
);
if (options.first < 2 || last > LAST_SEEDED_NUMBER) {
  log(
    `⚠ El seed de la API solo trae wb-02-5e0002 … wb-08-5e0008: la API descarta las demás ` +
      `(para cargar el broker sirven igual).`,
  );
}

sims.forEach((sim, i) => {
  // Escalonadas en el intervalo, así no publican todas en el mismo instante.
  const offset = Math.round((i * options.intervalMs) / options.count);
  timers.push(
    setTimeout(() => {
      publishReading(sim);
      timers.push(setInterval(() => publishReading(sim), options.intervalMs));
    }, offset),
  );
});
for (const injection of options.injections) timers.push(setTimeout(() => apply(injection), injection.atMs));
timers.push(setInterval(printStats, STATS_EVERY_MS));
if (options.durationMs > 0) timers.push(setTimeout(() => void stop(), options.durationMs));

process.on('SIGINT', () => void stop());
startConsole();
