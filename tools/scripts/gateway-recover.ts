import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { cleanupFixtures, FixtureJournal, runMarker, type ApiCall } from './gateway-fixtures';
import { gatewayComposeInvocation } from './gateway-compose.mjs';
import { readGatewaySettings } from './gateway-init.mjs';
import { acquireGatewayLock } from './gateway-lock.mjs';

export async function recoverRun(id: string): Promise<void> {
  const journal = new FixtureJournal(id, '.gateway/runs', true);
  // Recupera también un check-in confirmado por el servidor cuyo HTTP no llegó a guardarse en el diario.
  // Solo lectura, UUID validado; no depende del día operativo del endpoint de fila.
  const invocation = gatewayComposeInvocation([
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'vitalia',
    '-d',
    'vitalia',
    '-At',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    `SELECT id FROM tickets WHERE reason LIKE '${runMarker(id)}%';`,
  ]);
  const result = spawnSync('docker', invocation.args, {
    env: invocation.env,
    encoding: 'utf8',
    timeout: 15_000,
  });
  if (result.status !== 0) throw new Error('No se pudieron localizar los turnos de la corrida en PostgreSQL');
  const discovered = result.stdout.trim().split(/\s+/).filter(Boolean);
  const settings = readGatewaySettings();
  const origin = `http://localhost:${settings.GATEWAY_HTTP_PORT}/api`;
  let token: string | undefined;
  const call: ApiCall = async <T>(method: string, path: string, data?: unknown): Promise<T> => {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status}`);
    return response.json() as Promise<T>;
  };
  token = (
    await call<{ accessToken: string }>('POST', '/auth/login', {
      email: 'admin@vitalia.local',
      password: settings.SEED_PASSWORD,
    })
  ).accessToken;
  await cleanupFixtures(journal, call, discovered);
  console.log(`Corrida ${id} recuperada; historial conservado. Podés repetir la limpieza.`);
}
async function main(): Promise<void> {
  const id = process.argv
    .slice(2)
    .find((arg) => arg.startsWith('--run='))
    ?.slice(6);
  if (!id) {
    console.log('Corridas locales (para recuperar: pnpm gateway:recover --run=<UUID>):');
    for (const file of readdirSync('.gateway/runs').filter((f) => f.endsWith('.json'))) {
      const journal = new FixtureJournal(file.slice(0, -5), '.gateway/runs', true);
      console.log(
        `${journal.run.id} · ${journal.run.cleanedAt ? 'limpia' : 'pendiente'} · ${journal.run.startedAt}`,
      );
    }
    return;
  }
  const release = acquireGatewayLock();
  try {
    await recoverRun(id);
  } finally {
    release();
  }
}
if (process.argv[1]?.endsWith('gateway-recover.ts'))
  main().catch((error: unknown) => {
    console.error(
      'Recuperación fallida. Revisá el UUID, el diario, gateway levantado, seed y bloqueo operativo. No se imprimen credenciales.',
    );
    // El bloqueo contiene solo PID y fecha; el resto de los errores puede contener información sensible.
    if (error instanceof Error && error.message.startsWith('Hay un bloqueo operativo'))
      console.error(error.message);
    process.exitCode = 1;
  });
