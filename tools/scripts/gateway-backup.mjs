import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { gatewayComposeInvocation } from './gateway-compose.mjs';
import { acquireGatewayLock } from './gateway-lock.mjs';

const configuration = ['.env', 'mqtt/devices.json', 'mqtt/users', 'mqtt/acl'];
const allowedFile = /^(?:database\.dump|\.env|mqtt\/(?:devices\.json|users|acl)|runs\/[0-9a-f-]{36}\.json)$/;
const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

function docker(args, options = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 4 * 1024 * 1024,
    ...options,
  });
  // El stderr de pg_restore puede contener datos; solo se informa el estado.
  if (result.status !== 0) {
    const stage =
      ['pg_dump', 'pg_restore', 'createdb', 'psql'].find((name) => args.includes(name)) ?? 'Docker';
    throw new Error(`Falló ${stage}; revisá el servicio, la versión y los permisos del respaldo`);
  }
  return result.stdout?.trim() ?? '';
}

export function validateBackup(directory) {
  const manifest = JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8'));
  if (
    manifest.version !== 1 ||
    !manifest.files ||
    typeof manifest.files !== 'object' ||
    Array.isArray(manifest.files)
  )
    throw new Error('Manifiesto de respaldo inválido');
  for (const file of ['database.dump', ...configuration])
    if (!(file in manifest.files)) throw new Error('Respaldo incompleto');
  for (const [file, hash] of Object.entries(manifest.files)) {
    if (
      !allowedFile.test(file) ||
      !/^[a-f0-9]{64}$/.test(String(hash)) ||
      digest(resolve(directory, file)) !== hash
    )
      throw new Error('Integridad del respaldo inválida');
  }
  return manifest;
}

export function createBackup(directory = '.gateway') {
  const destination = resolve(
    directory,
    'backups',
    `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`,
  );
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  const files = [...configuration];
  if (existsSync(resolve(directory, 'runs')))
    files.push(
      ...readdirSync(resolve(directory, 'runs'))
        .filter((f) => /^[0-9a-f-]{36}\.json$/.test(f))
        .map((f) => `runs/${f}`),
    );
  const hashes = {};
  for (const file of files) {
    mkdirSync(resolve(destination, file, '..'), { recursive: true, mode: 0o700 });
    writeFileSync(resolve(destination, file), readFileSync(resolve(directory, file)), {
      flag: 'wx',
      mode: 0o600,
    });
    hashes[file] = digest(resolve(destination, file));
  }
  const invocation = gatewayComposeInvocation(
    [
      'exec',
      '-T',
      'postgres',
      'pg_dump',
      '-U',
      'vitalia',
      '-d',
      'vitalia',
      '--format=custom',
      '--no-owner',
      '--no-privileges',
    ],
    process.env,
    directory,
  );
  const output = openSync(resolve(destination, 'database.dump'), 'wx', 0o600);
  try {
    docker(invocation.args, { env: invocation.env, stdio: ['ignore', output, 'pipe'] });
  } finally {
    closeSync(output);
  }
  // Si se rotó configuración o cambió un diario durante el dump, no se acredita un bundle inconsistente.
  for (const file of files)
    if (digest(resolve(directory, file)) !== hashes[file])
      throw new Error(
        'La configuración o una corrida cambió durante el respaldo. Repetilo sin demos activas',
      );
  hashes['database.dump'] = digest(resolve(destination, 'database.dump'));
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim();
  const workingTreeDirty = !!spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout?.trim();
  writeFileSync(
    resolve(destination, 'manifest.json'),
    JSON.stringify(
      { version: 1, createdAt: new Date().toISOString(), revision, workingTreeDirty, files: hashes },
      null,
      2,
    ) + '\n',
    { flag: 'wx', mode: 0o600 },
  );
  validateBackup(destination);
  return destination;
}

/** Restaura realmente en PostgreSQL efímero, sin red ni volumen del gateway. */
export async function checkBackup(directory) {
  validateBackup(directory);
  const name = `vitalia-restore-${randomUUID()}`;
  let started = false;
  try {
    docker([
      'run',
      '-d',
      '--name',
      name,
      '--network',
      'none',
      '--tmpfs',
      '/var/lib/postgresql/data',
      '-e',
      'POSTGRES_HOST_AUTH_METHOD=trust',
      '--mount',
      `type=bind,source=${resolve(directory, 'database.dump')},target=/backup.dump,readonly`,
      'postgres:16-alpine',
    ]);
    started = true;
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      // El servidor temporal del entrypoint solo escucha Unix: esperá al definitivo por TCP.
      const result = spawnSync('docker', ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], {
        timeout: 5000,
        stdio: 'ignore',
      });
      if (result.status === 0) {
        ready = true;
        break;
      }
      await delay(500);
    }
    if (!ready) throw new Error('PostgreSQL de restauración no arrancó');
    docker(['exec', name, 'createdb', '-U', 'postgres', 'restored']);
    docker([
      'exec',
      name,
      'pg_restore',
      '-U',
      'postgres',
      '-d',
      'restored',
      '--exit-on-error',
      '--single-transaction',
      '--no-owner',
      '--no-privileges',
      '/backup.dump',
    ]);
    const counts = docker([
      'exec',
      name,
      'psql',
      '-U',
      'postgres',
      '-d',
      'restored',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      'SELECT (SELECT count(*) FROM tickets), (SELECT count(*) FROM telemetry_readings), (SELECT count(*) FROM staff_users), (SELECT count(*) FROM typeorm_migrations);',
    ]);
    if (!/^\d+\|\d+\|\d+\|[1-9]\d*$/.test(counts))
      throw new Error('El respaldo no contiene el esquema esperado');
    console.log(`Restauración aislada OK (turnos|lecturas|usuarios|migraciones): ${counts}`);
  } finally {
    if (started) docker(['rm', '-f', '-v', name]);
  }
}

async function main() {
  try {
    const check = process.argv.slice(2).find((arg) => arg.startsWith('--check='));
    if (check !== undefined) {
      if (!check.slice(8) || check.slice(8) === 'undefined') throw new Error('Usá --check=RUTA');
      await checkBackup(resolve(check.slice(8)));
    } else if (process.argv.includes('--check')) throw new Error('Usá --check=RUTA');
    else {
      const release = acquireGatewayLock();
      try {
        console.log(`Respaldo creado: ${createBackup()}`);
      } finally {
        release();
      }
    }
  } catch (error) {
    console.error(
      'Respaldo/restauración falló. Conservá los archivos y revisá la guía operativa; no se imprimen datos ni secretos.',
    );
    if (error instanceof Error && /^(Falló |Hay un bloqueo operativo)/.test(error.message))
      console.error(error.message);
    process.exitCode = 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === resolve('tools/scripts/gateway-backup.mjs')) void main();
