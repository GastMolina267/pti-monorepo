/**
 * Prueba de estrés de la Fase 5c: la consola con más de 10.000 registros simulados.
 *
 *   - Siembra en PostgreSQL N turnos del día (10.000 por defecto, ~20 % abiertos) con sus
 *     pacientes ficticios, y 24 h de lecturas cada 3 s (28.800) de una pulsera asignada.
 *   - Mide la API: `GET /api/tickets` (fila abierta y día completo) y la curva de 24 h
 *     `GET /api/tickets/:id/readings?minutes=1440`.
 *   - Con `--ui=http://localhost:4200`, mide en Chromium cuánto tarda el Backoffice en mostrar
 *     la fila de triaje, la lista de Turnos y la curva de 24 h.
 *   - Al final borra todo lo sembrado (`--keep` para dejarlo; `--cleanup` solo limpia una
 *     corrida anterior que se cortó).
 *
 *   pnpm perf:stress
 *   pnpm perf:stress --tickets=20000 --ui=http://localhost:4200 [--chromium=/ruta/chromium]
 *
 * Requiere `DATABASE_URL` (o `--db`) y la API levantada. Solo datos simulados (Ley 25.326):
 * los pacientes se llaman "Estrés NNNNN" y los turnos llevan el motivo {@link MARK}.
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { VitalsHistory } from '@vitalia/contracts';
import { toDayKey } from '../../apps/api/src/common/time/day-key';
import {
  criteriaTable,
  loadDotEnv,
  login,
  numberArg,
  parseArgs,
  saveReport,
  statsLine,
  stressShape,
  summarize,
  timed,
  type Criterion,
  type Stats,
} from './perf-lib';

const MARK = 'Prueba de estrés (perf:stress)';
const WEARABLE_CODE = 'wb-99-fe0099';
const FIRST_NUMBER = 1000;
const READINGS_24H = (24 * 3600) / 3;
const TARGETS = { restOpenP95: 200, restAllP95: 1000, curveP95: 300, uiMs: 2000 };
/** Filas por tanda del Backoffice (`LIST_STEP` de `shared/show-more.ts`). */
const LIST_STEP = 50;
const NAMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Facundo', 'Gabriela', 'Hernán', 'Inés', 'Joaquín'];

async function main(): Promise<void> {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const dbUrl = (args['db'] ?? process.env['DATABASE_URL']) as string | undefined;
  if (!dbUrl) throw new Error('falta DATABASE_URL (o --db=postgresql://…)');
  const db = new pg.Client({ connectionString: dbUrl });
  await db.connect();
  try {
    if (args['cleanup']) {
      await cleanup(db);
      return;
    }
    try {
      await run(db, args);
    } finally {
      // También si una medición falla: la base de desarrollo no queda con 10.000 turnos.
      if (!args['keep']) await cleanup(db);
    }
  } finally {
    await db.end();
  }
}

async function run(db: pg.Client, args: Record<string, string | true>): Promise<void> {
  const total = numberArg(args, 'tickets', 10_000);
  const samples = numberArg(args, 'samples', 30);
  const api = String(args['api'] ?? `http://localhost:${process.env['API_PORT'] ?? 3000}`).replace(/\/$/, '');
  const timeZone = process.env['HOSPITAL_TIMEZONE'] || 'America/Argentina/Cordoba';
  const token = await login(
    api,
    String(args['email'] ?? 'admin@vitalia.local'),
    String(args['password'] ?? 'Vitalia2026!'),
  );

  await cleanup(db, true);
  console.log(`▶ Sembrando ${total} turnos y ${READINGS_24H} lecturas…`);
  const seedStarted = performance.now();
  const { ticketId, ticketCode, openCount } = await seed(db, total, toDayKey(new Date(), timeZone));
  const seedSeconds = (performance.now() - seedStarted) / 1000;

  const measure = async (url: string) => {
    const ms: number[] = [];
    let bytes = 0;
    let rows = 0;
    await timed(url, token); // calienta caché de planes y conexiones
    for (let i = 0; i < samples; i++) {
      const r = await timed<unknown[] | VitalsHistory>(url, token);
      ms.push(r.ms);
      bytes = r.bytes;
      rows = Array.isArray(r.body) ? r.body.length : r.body.points.length;
    }
    return { stats: summarize(ms), bytes, rows };
  };

  console.log('  midiendo la API…');
  const open = await measure(`${api}/api/tickets`);
  const all = await measure(`${api}/api/tickets?status=WAITING,CALLED,IN_PROGRESS,DONE,NO_SHOW,CANCELLED`);
  const curve = await measure(`${api}/api/tickets/${ticketId}/readings?minutes=1440`);

  const ui =
    typeof args['ui'] === 'string'
      ? await measureUi(args['ui'], args, ticketCode, openCount, all.rows)
      : null;

  const kb = (b: number) => `${(b / 1024).toFixed(0)} KB`;
  const criteria: Criterion[] = [
    {
      name: `\`GET /api/tickets\` con ${total.toLocaleString('es-AR')} turnos (fila abierta)`,
      target: `p95 < ${TARGETS.restOpenP95} ms`,
      measured: `${statsLine(open.stats)} · ${open.rows} filas · ${kb(open.bytes)}`,
      ok: open.stats.p95 < TARGETS.restOpenP95,
    },
    {
      name: 'Día completo (Turnos, todos los estados)',
      target: `p95 < ${TARGETS.restAllP95} ms`,
      measured: `${statsLine(all.stats)} · ${all.rows} filas · ${kb(all.bytes)}`,
      ok: all.stats.p95 < TARGETS.restAllP95,
    },
    {
      name: `Curva de 24 h (${READINGS_24H.toLocaleString('es-AR')} lecturas)`,
      target: `p95 < ${TARGETS.curveP95} ms`,
      measured: `${statsLine(curve.stats)} · ${curve.rows} puntos · ${kb(curve.bytes)}`,
      ok: curve.stats.p95 < TARGETS.curveP95,
    },
    ...(ui
      ? [
          ...Object.entries(ui.times).map(([name, ms]) => ({
            name: `Backoffice: ${name}`,
            target: `< ${TARGETS.uiMs} ms`,
            measured: `${Math.round(ms)} ms`,
            ok: ms < TARGETS.uiMs,
          })),
          {
            name: 'Backoffice sin Internet (RNF-O2)',
            target: '0 pedidos fuera del gateway',
            measured: ui.external.length ? ui.external.slice(0, 3).join(', ') : '0 pedidos externos',
            ok: ui.external.length === 0,
          },
        ]
      : []),
  ];

  const file = saveReport('stress', {
    kind: 'stress',
    at: new Date().toISOString(),
    config: { total, samples, api, readings: READINGS_24H },
    seedSeconds,
    api: { open, all, curve } satisfies Record<string, { stats: Stats; bytes: number; rows: number }>,
    ui,
    criteria,
  });

  console.log(`\nSiembra: ${seedSeconds.toFixed(1)} s\n\n${criteriaTable(criteria)}\n\nReporte: ${file}`);
  if (criteria.some((c) => !c.ok)) process.exitCode = 1;
}

async function seed(
  db: pg.Client,
  total: number,
  dayKey: string,
): Promise<{ ticketId: string; ticketCode: string; openCount: number }> {
  const services = (
    await db.query<{ id: string; prefix: string }>('SELECT id, prefix FROM service_areas ORDER BY code')
  ).rows;
  if (services.length === 0) throw new Error('no hay servicios: corré pnpm db:seed');

  const patientIds: string[] = [];
  const first: string[] = [];
  const last: string[] = [];
  const t = {
    id: [] as string[],
    code: [] as string[],
    number: [] as number[],
    status: [] as string[],
    level: [] as string[],
    service: [] as string[],
    checkedIn: [] as string[],
  };
  const now = Date.now();
  let openCount = 0;
  for (let i = 0; i < total; i++) {
    const s = services[i % services.length];
    const number = FIRST_NUMBER + Math.floor(i / services.length);
    const { status, level } = stressShape(i);
    if (status === 'WAITING') openCount++;
    patientIds.push(randomUUID());
    first.push(NAMES[i % NAMES.length]);
    last.push(`Estrés ${String(i).padStart(5, '0')}`);
    t.id.push(randomUUID());
    t.code.push(`${s.prefix}-${number}`);
    t.number.push(number);
    t.status.push(status);
    t.level.push(level);
    t.service.push(s.id);
    t.checkedIn.push(new Date(now - (total - i) * 1000).toISOString());
  }

  await db.query('BEGIN');
  try {
    await db.query(
      `INSERT INTO patients (id, first_name, last_name) SELECT * FROM unnest($1::uuid[], $2::text[], $3::text[])`,
      [patientIds, first, last],
    );
    await db.query(
      `INSERT INTO tickets (id, code, number, day_key, status, triage_level, source, reason, service_id, patient_id, checked_in_at)
       SELECT u.id, u.code, u.number, $8, u.status::ticket_status, u.level::triage_level, 'RECEPTION', $9, u.service, u.patient, u.checked_in
       FROM unnest($1::uuid[], $2::text[], $3::int[], $4::text[], $5::text[], $6::uuid[], $7::uuid[], $10::timestamptz[])
         AS u(id, code, number, status, level, service, patient, checked_in)`,
      [t.id, t.code, t.number, t.status, t.level, t.service, patientIds, dayKey, MARK, t.checkedIn],
    );
    // Pulsera con 24 h de lecturas asignada al primer turno en espera
    const firstWaiting = t.status.indexOf('WAITING');
    const ticketId = t.id[firstWaiting];
    const w = await db.query<{ id: string }>(
      `INSERT INTO wearables (code, label, status, ticket_id, last_seen_at, last_room)
       VALUES ($1, 'Estrés 24 h', 'ASSIGNED', $2, now(), 'estres') RETURNING id`,
      [WEARABLE_CODE, ticketId],
    );
    await db.query(
      `INSERT INTO telemetry_readings (wearable_id, ticket_id, seq, measured_at, heart_rate, spo2, temperature, acc_peak_g, fall, triage_level)
       SELECT $1, $2, g, now() - make_interval(secs => ($3 - g) * 3),
              (72 + 8 * sin(g / 400.0) + (random() * 6 - 3))::smallint,
              (97 + (random() * 2))::smallint,
              round((36.6 + 0.3 * sin(g / 900.0))::numeric, 1),
              round((1 + random() * 0.2)::numeric, 2), false, 'STABLE'
       FROM generate_series(1, $3) AS g`,
      [w.rows[0].id, ticketId, READINGS_24H],
    );
    await db.query('COMMIT');
    await db.query('ANALYZE tickets; ANALYZE telemetry_readings; ANALYZE patients');
    return { ticketId, ticketCode: t.code[firstWaiting], openCount };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

async function cleanup(db: pg.Client, quiet = false): Promise<void> {
  await db.query('BEGIN');
  try {
    const w = await db.query<{ id: string }>('SELECT id FROM wearables WHERE code = $1', [WEARABLE_CODE]);
    const wid = w.rows[0]?.id;
    if (wid) {
      await db.query('DELETE FROM telemetry_readings WHERE wearable_id = $1', [wid]);
      await db.query('DELETE FROM alerts WHERE wearable_id = $1', [wid]);
      await db.query('DELETE FROM wearables WHERE id = $1', [wid]);
    }
    const tickets = await db.query<{ patient_id: string }>(
      'DELETE FROM tickets WHERE reason = $1 RETURNING patient_id',
      [MARK],
    );
    const patients = tickets.rows.map((r) => r.patient_id);
    if (patients.length) await db.query('DELETE FROM patients WHERE id = ANY($1::uuid[])', [patients]);
    await db.query('COMMIT');
    if (!quiet || tickets.rowCount)
      console.log(`  limpieza: ${tickets.rowCount ?? 0} turnos de estrés borrados`);
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

/** Tiempos de pantalla en Chromium (navegación → contenido visible), con sesión de enfermería. */
async function measureUi(
  base: string,
  args: Record<string, string | true>,
  code: string,
  openCount: number,
  dayCount: number,
): Promise<{ times: Record<string, number>; external: string[] }> {
  const { chromium } = await import('@playwright/test');
  const executablePath =
    typeof args['chromium'] === 'string'
      ? args['chromium']
      : process.env['PLAYWRIGHT_CHROMIUM_PATH'] || undefined;
  const browser = await chromium.launch({ executablePath });
  const out: Record<string, number> = {};
  const external = new Set<string>();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    // Todo (fuentes, íconos, scripts) tiene que salir del gateway: nada de CDNs.
    const origin = new URL(base).host;
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (/^(https?|wss?):$/.test(url.protocol) && url.host !== origin) external.add(url.host);
    });
    await page.goto(`${base}/login`);
    await page.fill('input[type=email]', 'enfermeria@vitalia.local');
    await page.fill('input[type=password]', String(args['password'] ?? 'Vitalia2026!'));
    await page.click('button[type=submit]');
    await page.waitForURL('**/triaje');

    const time = async (label: string, url: string, ready: () => Promise<unknown>) => {
      const started = performance.now();
      await page.goto(url);
      await ready();
      out[label] = performance.now() - started;
    };
    // Si hay alertas activas, el aviso rojo aparece al cargar y tapa la pantalla: se minimiza.
    const minimizeAlerts = () =>
      page
        .locator('[role=alertdialog]')
        .waitFor({ state: 'visible', timeout: 2500 })
        .then(() => page.click('text=Minimizar'))
        .catch(() => undefined);

    await time(`fila de triaje (${openCount} en espera)`, `${base}/triaje`, () =>
      page.waitForFunction(
        (n) => document.querySelectorAll('li.row').length >= n,
        Math.min(openCount, LIST_STEP),
        { timeout: 30_000 },
      ),
    );
    await minimizeAlerts();
    await time('Turnos del día (lista completa)', `${base}/turnos`, () =>
      page.waitForFunction(
        (n) => document.querySelectorAll('.tr[role=row]:not(.th)').length >= n,
        Math.min(dayCount, LIST_STEP),
        { timeout: 30_000 },
      ),
    );
    await page.goto(`${base}/triaje`);
    await page.locator('li.row').first().waitFor({ timeout: 30_000 });
    await minimizeAlerts();
    {
      const started = performance.now();
      await page.locator(`button[aria-label="Ver signos vitales de ${code}"]`).click();
      await page.click('button:has-text("24 h")');
      await page.locator('vt-vitals-chart path.line').first().waitFor({ timeout: 30_000 });
      out['curva de 24 h (abrir + dibujar)'] = performance.now() - started;
    }
  } finally {
    await browser.close();
  }
  return { times: out, external: [...external] };
}

main().catch((err: unknown) => {
  console.error('✖ perf:stress falló:', err instanceof Error ? err.message : err);
  process.exit(1);
});
