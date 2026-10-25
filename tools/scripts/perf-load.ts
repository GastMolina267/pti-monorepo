/**
 * Prueba de carga y latencias de la Fase 5c (RNF-O1, objetivos del roadmap):
 *
 *   - N pulseras (50 por defecto) publican lecturas cifradas cada 3 s por MQTT QoS 1.
 *   - Pérdida: lecturas confirmadas por el broker (PUBACK) vs. recibidas por WebSocket vs.
 *     guardadas en PostgreSQL (con `DATABASE_URL`).
 *   - Latencias: lectura → `telemetry:reading` (staff), caída → `alert:emergency`,
 *     `GET /api/tickets` durante la carga y llamado → `ticket:called` en la sala `tv`.
 *
 * Las pulseras de carga son `wb-10-fe0010`, `wb-11-fe0011`…: se dan de alta solas y, si hay
 * `DATABASE_URL`, al final se borran con sus lecturas y alertas (`--keep` para dejarlas).
 * Todo se mide con el mismo reloj (este proceso), así que no hace falta sincronizar NTP.
 *
 *   pnpm perf:load                                  # 50 pulseras · 3 s · 120 s
 *   pnpm perf:load --duration=600 --falls=40 --calls=40
 *   pnpm perf:load --api=http://10.0.30.1 --mqtt=mqtt://10.0.20.1:1884 --mqtt-user=… --mqtt-pass=…
 *
 * Usa `TELEMETRY_AES_KEY`, `MQTT_URL` y `DATABASE_URL` del `.env` si no se pasan. Solo datos
 * simulados (Ley 25.326). El reporte queda en `.perf/*.json` y la tabla se imprime en Markdown.
 */
import mqtt, { type MqttClient } from 'mqtt';
import pg from 'pg';
import { io, type Socket } from 'socket.io-client';
import {
  MQTT_QOS,
  MQTT_TOPICS,
  REALTIME_EVENTS,
  REALTIME_READY_EVENT,
  composeSeq,
  formatWearableCode,
  type AlertEmergencyEvent,
  type ConsultingRoom,
  type PublicTicket,
  type Ticket,
  type TicketCalledEvent,
  type TelemetryReading,
  type TelemetryReadingEvent,
  type Wearable,
} from '@vitalia/contracts';
import { parseKey, sealReading } from '../wearable-simulator/src/lib/envelope';
import { createRng } from '../wearable-simulator/src/lib/rng';
import { VitalsModel } from '../wearable-simulator/src/lib/vitals';
import { nextBoot } from '../wearable-simulator/src/lib/wearable';
import {
  criteriaTable,
  loadDotEnv,
  login,
  numberArg,
  parseArgs,
  saveReport,
  sleep,
  statsLine,
  summarize,
  timed,
  type Criterion,
} from './perf-lib';

const FIRST_NUMBER = 10;
const ROOM = 'carga';
const TARGETS = { alertP95: 500, restP95: 50, callP95: 100, telemetryP95: 500 };

interface PerfWearable {
  id: string;
  code: string;
  topic: string;
  vitals: VitalsModel;
  counter: number;
  client: MqttClient;
  published: number;
  failed: number;
}

function usage(): never {
  console.log(`Uso: pnpm perf:load [--count=50] [--interval=3] [--duration=120] [--falls=20] [--calls=20]
  [--rest-every=500] [--api=http://localhost:3000] [--mqtt=mqtt://localhost:1883] [--mqtt-user=… --mqtt-pass=…]
  [--key=<64 hex>] [--db=postgresql://…] [--email=admin@vitalia.local --password=…] [--keep]`);
  process.exit(0);
}

async function main(): Promise<void> {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  if (args['help']) usage();

  const count = numberArg(args, 'count', 50);
  if (count > 99 - FIRST_NUMBER + 1)
    throw new Error(`--count admite hasta ${99 - FIRST_NUMBER + 1} pulseras`);
  const intervalMs = numberArg(args, 'interval', 3) * 1000;
  const durationMs = numberArg(args, 'duration', 120) * 1000;
  const falls = numberArg(args, 'falls', 20);
  const calls = numberArg(args, 'calls', 20);
  const restEveryMs = numberArg(args, 'rest-every', 500);
  const api = String(args['api'] ?? `http://localhost:${process.env['API_PORT'] ?? 3000}`).replace(/\/$/, '');
  const mqttUrl = String(args['mqtt'] ?? process.env['MQTT_URL'] ?? 'mqtt://localhost:1883');
  const key = parseKey(String(args['key'] ?? process.env['TELEMETRY_AES_KEY'] ?? ''));
  const dbUrl = (args['db'] ?? process.env['DATABASE_URL']) as string | undefined;
  const email = String(args['email'] ?? 'admin@vitalia.local');
  const password = String(args['password'] ?? process.env['PERF_PASSWORD'] ?? 'Vitalia2026!');

  console.log(
    `▶ ${count} pulseras cada ${intervalMs / 1000} s durante ${durationMs / 1000} s → ${api} · ${mqttUrl}`,
  );
  const token = await login(api, email, password);
  const db = dbUrl ? new pg.Client({ connectionString: dbUrl }) : null;
  await db?.connect();

  // 1) Pulseras de carga dadas de alta (idempotente)
  const codes = Array.from({ length: count }, (_, i) => {
    const n = FIRST_NUMBER + i;
    return formatWearableCode(n, `fe00${String(n).padStart(2, '0')}`);
  });
  const existing = (await timed<Wearable[]>(`${api}/api/wearables`, token)).body;
  const byCode = new Map(existing.map((w) => [w.code, w]));
  for (const code of codes) {
    if (byCode.has(code)) continue;
    const created = await timed<Wearable>(`${api}/api/wearables`, token, {
      method: 'POST',
      body: JSON.stringify({ code, label: `Carga ${code.slice(3, 5)}` }),
    });
    byCode.set(code, created.body);
  }

  // 2) Sockets: personal (lecturas y alertas) y TV (llamados)
  const staff = await connectSocket(api, { token });
  const tv = await connectSocket(api, { role: 'tv' });

  const codeSet = new Set(codes);
  const telemetryLatency: number[] = [];
  const received = new Map<string, number>();
  staff.on(REALTIME_EVENTS.TELEMETRY_READING, (e: TelemetryReadingEvent) => {
    if (!codeSet.has(e.wearableId)) return;
    telemetryLatency.push(Date.now() - e.reading.ts);
    received.set(e.wearableId, (received.get(e.wearableId) ?? 0) + 1);
  });

  const alertLatency: number[] = [];
  const pendingFalls = new Map<string, number>();
  const ackQueue: Promise<unknown>[] = [];
  staff.on(REALTIME_EVENTS.ALERT_EMERGENCY, (e: AlertEmergencyEvent) => {
    if (!codeSet.has(e.wearableId) || e.kind !== 'FALL') return;
    const sentAt = pendingFalls.get(e.wearableId);
    if (sentAt === undefined) return;
    pendingFalls.delete(e.wearableId);
    alertLatency.push(Date.now() - Date.parse(e.detectedAt));
    // Reconocerla libera la pulsera para la próxima caída (una alerta activa por tipo).
    // La alerta se emite antes de guardarse (`AlertsService.raise`): si el reconocimiento llega primero,
    // la API responde 404 y se reintenta.
    ackQueue.push(
      (async () => {
        for (let attempt = 1; ; attempt++) {
          await sleep(100 * attempt);
          try {
            return await timed(`${api}/api/alerts/${e.alertId}/ack`, token, { method: 'POST' });
          } catch (err) {
            if (attempt === 5)
              return console.warn(`  no se pudo reconocer ${e.alertId}: ${(err as Error).message}`);
          }
        }
      })(),
    );
  });

  // 3) Conexiones MQTT, una por pulsera (client ID = código, como el firmware)
  const boot = nextBoot(Date.now());
  const rng = createRng(Date.now() & 0xffff);
  const wearables: PerfWearable[] = await Promise.all(
    codes.map(async (code) => {
      const client = await connectMqtt(mqttUrl, code, args);
      return {
        id: byCode.get(code)!.id,
        code,
        topic: MQTT_TOPICS.wearableData(ROOM, code),
        vitals: new VitalsModel(rng),
        counter: 0,
        client,
        published: 0,
        failed: 0,
      };
    }),
  );

  const publish = (w: PerfWearable) => {
    const now = Date.now();
    const v = w.vitals.next(now);
    const reading: TelemetryReading = {
      wearableId: w.code,
      seq: composeSeq(boot, w.counter++),
      ts: now,
      hr: v.hr,
      spo2: v.spo2,
      temp: v.temp,
      accPeakG: v.accPeakG,
      fall: v.fall,
    };
    if (reading.fall) pendingFalls.set(w.code, now);
    w.client.publish(w.topic, JSON.stringify(sealReading(reading, key)), { qos: MQTT_QOS }, (err) =>
      err ? w.failed++ : w.published++,
    );
  };

  // 4) Carga: cada pulsera con su desfase dentro del intervalo
  const startedAt = new Date();
  const timers: NodeJS.Timeout[] = [];
  wearables.forEach((w, i) => {
    timers.push(
      setTimeout(
        () => {
          publish(w);
          timers.push(setInterval(() => publish(w), intervalMs));
        },
        Math.round((i * intervalMs) / count),
      ),
    );
  });

  // Caídas repartidas en la corrida, en pulseras distintas (se publican en el momento, como el firmware)
  for (let i = 0; i < falls; i++) {
    const w = wearables[i % count];
    timers.push(
      setTimeout(
        () => {
          w.vitals.start('fall', Date.now(), 0);
          publish(w);
        },
        Math.round(((i + 0.5) * (durationMs - 5000)) / falls),
      ),
    );
  }

  const restLatency: number[] = [];
  const restErrors: string[] = [];
  let restBytes = 0;
  const callLatency: number[] = [];
  const callRestLatency: number[] = [];
  const stop = Date.now() + durationMs;

  const restLoop = (async () => {
    while (Date.now() < stop) {
      try {
        const r = await timed<Ticket[]>(`${api}/api/tickets`, token);
        restLatency.push(r.ms);
        restBytes = r.bytes;
      } catch (err) {
        restErrors.push((err as Error).message);
      }
      await sleep(restEveryMs);
    }
  })();

  const callLoop = (async () => {
    const rooms = (await timed<ConsultingRoom[]>(`${api}/api/consulting-rooms`, token)).body;
    const room = rooms[0];
    const created = await fetch(`${api}/api/check-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Prueba',
        lastName: 'Rendimiento',
        serviceCode: 'CLINICA',
        source: 'RECEPTION',
        reason: 'Prueba de carga (perf:load)',
      }),
    });
    if (!created.ok) throw new Error(`check-in de la prueba falló: HTTP ${created.status}`);
    const ticket = (await created.json()) as PublicTicket;
    const gap = Math.max(1000, (durationMs - 5000) / calls);
    for (let i = 0; i < calls && Date.now() < stop; i++) {
      const arrived = new Promise<number>((resolve) => {
        const onCalled = (e: TicketCalledEvent) => {
          if (e.ticketId !== ticket.id) return;
          tv.off(REALTIME_EVENTS.TICKET_CALLED, onCalled);
          resolve(Date.now());
        };
        tv.on(REALTIME_EVENTS.TICKET_CALLED, onCalled);
      });
      const t0 = Date.now();
      const r = await timed(`${api}/api/tickets/${ticket.id}/call`, token, {
        method: 'POST',
        body: JSON.stringify({ consultingRoomId: room.id }),
      });
      callRestLatency.push(r.ms);
      callLatency.push((await withTimeout(arrived, 5000)) - t0);
      await sleep(gap);
    }
    await timed(`${api}/api/tickets/${ticket.id}/status`, token, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'NO_SHOW' }),
    });
  })();

  await Promise.all([restLoop, callLoop, sleep(durationMs)]);
  for (const t of timers) clearInterval(t);
  console.log('  carga terminada; esperando confirmaciones y persistencia…');
  await sleep(5000);
  await Promise.all(ackQueue);

  // 5) Conteos
  const published = wearables.reduce((a, w) => a + w.published, 0);
  const failed = wearables.reduce((a, w) => a + w.failed, 0);
  const viaWs = [...received.values()].reduce((a, b) => a + b, 0);
  let persisted: number | null = null;
  if (db) {
    const ids = wearables.map((w) => w.id);
    const res = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM telemetry_readings WHERE wearable_id = ANY($1::uuid[]) AND measured_at >= $2`,
      [ids, startedAt],
    );
    persisted = Number(res.rows[0].n);
  }

  await Promise.all(wearables.map((w) => w.client.endAsync()));
  staff.disconnect();
  tv.disconnect();

  const telemetry = summarize(telemetryLatency);
  const alert = summarize(alertLatency);
  const rest = summarize(restLatency);
  const call = summarize(callLatency);
  const lossBase = persisted ?? viaWs;
  const lossPct = published ? Math.max(0, ((published - lossBase) / published) * 100) : 100;

  const criteria: Criterion[] = [
    {
      name: `Carga: ${count} pulseras cada ${intervalMs / 1000} s (QoS 1)`,
      target: '0 % de pérdida',
      measured: `${published} confirmadas · ${viaWs} por WS${persisted === null ? '' : ` · ${persisted} guardadas`} → ${lossPct.toFixed(2)} %`,
      ok: failed === 0 && lossPct === 0,
    },
    {
      name: 'Lectura → `telemetry:reading`',
      target: `p95 < ${TARGETS.telemetryP95} ms`,
      measured: statsLine(telemetry),
      ok: telemetry.n > 0 && telemetry.p95 < TARGETS.telemetryP95,
    },
    {
      name: 'Caída → `alert:emergency`',
      target: `p95 < ${TARGETS.alertP95} ms`,
      measured: `${statsLine(alert)} · ${alert.n}/${falls} alertas`,
      ok: alert.n === falls && alert.p95 < TARGETS.alertP95,
    },
    {
      name: '`GET /api/tickets` bajo carga',
      target: `p95 < ${TARGETS.restP95} ms`,
      measured: `${statsLine(rest)} · ${(restBytes / 1024).toFixed(1)} KB${restErrors.length ? ` · ${restErrors.length} errores` : ''}`,
      ok: rest.n > 0 && rest.p95 < TARGETS.restP95 && restErrors.length === 0,
    },
    {
      name: 'Llamado → `ticket:called` en la TV',
      target: `p95 < ${TARGETS.callP95} ms`,
      measured: statsLine(call),
      ok: call.n > 0 && call.p95 < TARGETS.callP95,
    },
  ];

  const report = {
    kind: 'load',
    startedAt: startedAt.toISOString(),
    config: { count, intervalMs, durationMs, falls, calls, restEveryMs, api, mqttUrl },
    counts: { published, failed, viaWs, persisted, lossPct },
    latencyMs: { telemetry, alert, rest, call, callRest: summarize(callRestLatency) },
    restErrors: restErrors.slice(0, 10),
    criteria,
  };
  const file = saveReport('load', report);

  if (db && !args['keep'])
    await cleanup(
      db,
      wearables.map((w) => w.id),
    );
  await db?.end();

  console.log(`\n${criteriaTable(criteria)}\n\nReporte: ${file}`);
  if (persisted === null)
    console.log('ℹ Sin DATABASE_URL: la pérdida se calcula contra lo recibido por WebSocket.');
  if (criteria.some((c) => !c.ok)) process.exitCode = 1;
}

async function cleanup(db: pg.Client, ids: string[]): Promise<void> {
  await db.query('BEGIN');
  try {
    await db.query('DELETE FROM telemetry_readings WHERE wearable_id = ANY($1::uuid[])', [ids]);
    await db.query('DELETE FROM alerts WHERE wearable_id = ANY($1::uuid[])', [ids]);
    await db.query('DELETE FROM wearables WHERE id = ANY($1::uuid[]) AND ticket_id IS NULL', [ids]);
    await db.query('COMMIT');
    console.log(`  pulseras de carga borradas (${ids.length}) con sus lecturas y alertas`);
  } catch (err) {
    await db.query('ROLLBACK');
    console.warn(`  no se pudieron borrar las pulseras de carga: ${(err as Error).message}`);
  }
}

function connectSocket(api: string, auth: Record<string, string>): Promise<Socket> {
  const socket = io(api, { auth, transports: ['websocket'], reconnection: false });
  return withTimeout(
    new Promise<Socket>((resolve, reject) => {
      socket.once(REALTIME_READY_EVENT, () => resolve(socket));
      socket.once('connect_error', reject);
    }),
    10_000,
  );
}

function connectMqtt(
  url: string,
  clientId: string,
  args: Record<string, string | true>,
): Promise<MqttClient> {
  const client = mqtt.connect(url, {
    clientId,
    clean: true,
    reconnectPeriod: 1000,
    username: typeof args['mqtt-user'] === 'string' ? args['mqtt-user'] : undefined,
    password: typeof args['mqtt-pass'] === 'string' ? args['mqtt-pass'] : undefined,
  });
  return withTimeout(
    new Promise<MqttClient>((resolve, reject) => {
      client.once('connect', () => resolve(client));
      client.once('error', reject);
    }),
    10_000,
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`sin respuesta en ${ms} ms`)), ms);
    promise.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e: unknown) => (clearTimeout(t), reject(e)),
    );
  });
}

main().catch((err: unknown) => {
  console.error('✖ perf:load falló:', err instanceof Error ? err.message : err);
  process.exit(1);
});
