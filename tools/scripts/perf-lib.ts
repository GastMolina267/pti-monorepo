/**
 * Utilidades de las pruebas de rendimiento de la Fase 5c (`perf:load` y `perf:stress`):
 * estadísticas, login y reporte. Funciones puras salvo `login`/`timed`; se prueban en
 * `perf-lib.spec.ts`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Stats {
  n: number;
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

/** Percentil por rango más cercano (el valor observado, sin interpolar). `p` en 0–100. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

export function summarize(samples: readonly number[]): Stats {
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    n,
    min: round(sorted[0] ?? Number.NaN),
    p50: round(percentile(sorted, 50)),
    p95: round(percentile(sorted, 95)),
    p99: round(percentile(sorted, 99)),
    max: round(sorted[n - 1] ?? Number.NaN),
    mean: round(n ? sorted.reduce((a, b) => a + b, 0) / n : Number.NaN),
  };
}

export interface Criterion {
  name: string;
  /** Texto del objetivo (`p95 < 500 ms`). */
  target: string;
  measured: string;
  ok: boolean;
}

/** Tabla Markdown de criterios para pegar en `docs/10-validacion.md` y en la tesis. */
export function criteriaTable(criteria: readonly Criterion[]): string {
  const rows = criteria.map((c) => `| ${c.name} | ${c.target} | ${c.measured} | ${c.ok ? '✅' : '❌'} |`);
  return ['| Criterio | Objetivo | Medido | |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

export function statsLine(s: Stats, unit = 'ms'): string {
  if (s.n === 0) return 'sin muestras';
  return `p50 ${s.p50} · p95 ${s.p95} · p99 ${s.p99} · máx ${s.max} ${unit} (n=${s.n})`;
}

/** Lee `--clave=valor` y `--bandera`. Lo que no se pasa queda `undefined`. */
export function parseArgs(argv: readonly string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (const arg of argv) {
    const m = /^--([a-z][\w-]*)(?:=(.*))?$/i.exec(arg);
    if (m) out[m[1]] = m[2] ?? true;
  }
  return out;
}

export function numberArg(args: Record<string, string | true>, name: string, fallback: number): number {
  const raw = args[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (raw === true || !Number.isFinite(value) || value <= 0) {
    throw new Error(`--${name} tiene que ser un número positivo`);
  }
  return value;
}

export function loadDotEnv(): void {
  try {
    process.loadEnvFile('.env');
  } catch {
    // sin .env: valen los argumentos y las variables del entorno
  }
}

export async function login(api: string, email: string, password: string): Promise<string> {
  const res = await fetch(`${api}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`login de ${email} falló: HTTP ${res.status}`);
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}

/** `fetch` JSON con Bearer que mide la duración de la respuesta completa (headers + cuerpo). */
export async function timed<T>(
  url: string,
  token: string,
  init: RequestInit = {},
): Promise<{ ms: number; body: T; bytes: number }> {
  const started = performance.now();
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...init.headers },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  const ms = performance.now() - started;
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${url} → HTTP ${res.status}: ${text.slice(0, 200)}`);
  return { ms, body: (text ? JSON.parse(text) : undefined) as T, bytes: Buffer.byteLength(text) };
}

/** Guarda el reporte JSON en `.perf/` (ignorado por git) y devuelve la ruta. */
export function saveReport(kind: string, report: unknown): string {
  const dir = '.perf';
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${kind}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  return file;
}

/** Estado y nivel de triaje de la fila `i`: ~20 % abiertos, como un día cargado. */
export function stressShape(i: number): { status: string; level: string } {
  const r = i % 20;
  const status =
    r < 3
      ? 'WAITING'
      : r === 3
        ? 'CALLED'
        : r < 15
          ? 'DONE'
          : r < 17
            ? 'IN_PROGRESS'
            : r < 19
              ? 'NO_SHOW'
              : 'CANCELLED';
  const level = i % 11 === 0 ? 'CRITICAL' : i % 4 === 0 ? 'ATTENTION' : 'STABLE';
  return { status, level };
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
