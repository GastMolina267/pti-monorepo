import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { gatewayComposeInvocation } from './gateway-compose.mjs';
import { readGatewaySettings } from './gateway-init.mjs';

/**
 * Exposición pública del gateway con Cloudflare Tunnel (`pnpm gateway:tunnel`).
 * Sin token: túneles rápidos (trycloudflare.com, URL aleatoria). Con CLOUDFLARE_TUNNEL_TOKEN en
 * .gateway/.env: el túnel con nombre del equipo, con los hostnames configurados en Cloudflare.
 */
export const QUICK_TUNNELS = [
  { service: 'tunnel-backoffice', label: 'Backoffice (consola del personal)', health: '/api/health' },
  { service: 'tunnel-tv', label: 'TV (llamador)', health: '/api/health' },
  { service: 'tunnel-landing', label: 'Landing (sitio público)', health: '/gateway-health' },
];

export const TUNNEL_SERVICES = ['landing', ...QUICK_TUNNELS.map((t) => t.service), 'tunnel'];
const ALL_PROFILES = ['--profile', 'landing', '--profile', 'tunnel', '--profile', 'tunnel-named'];

/** Última URL de túnel rápido en los logs de cloudflared (la de la conexión vigente). */
export function quickTunnelUrl(log) {
  // api.trycloudflare.com es el servicio que entrega las URLs (aparece en los errores), no un túnel.
  const urls = (log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi) ?? [])
    .map((url) => url.toLowerCase())
    .filter((url) => url !== 'https://api.trycloudflare.com');
  return urls.at(-1) ?? null;
}

export function tunnelMode(settings) {
  return settings.CLOUDFLARE_TUNNEL_TOKEN?.trim() ? 'named' : 'quick';
}

/** Argumentos de Compose para cada acción; el resto del gateway no se toca al bajar los túneles. */
export function tunnelComposeArgs(action, mode) {
  if (action === 'up') {
    const profile = mode === 'named' ? 'tunnel-named' : 'tunnel';
    return ['--profile', profile, 'up', '--build', '-d', '--wait', '--wait-timeout', '300'];
  }
  if (action === 'down') return [...ALL_PROFILES, 'rm', '--stop', '--force', ...TUNNEL_SERVICES];
  if (action === 'logs') return [...ALL_PROFILES, 'logs', '--no-color'];
  throw new Error(`Acción desconocida: ${action}`);
}

/**
 * Detrás del túnel hay dos saltos (cloudflared → Nginx): con TRUST_PROXY=2 la API cuenta los
 * límites por cliente y no por la IP de cloudflared. Lo que diga .gateway/.env tiene prioridad.
 */
export function tunnelEnvironment(settings) {
  return { GATEWAY_TRUST_PROXY: settings.GATEWAY_TRUST_PROXY || '2' };
}

function compose(args, extraEnv = {}, capture = false) {
  const invocation = gatewayComposeInvocation(args, { ...process.env, ...extraEnv });
  const result = spawnSync('docker', invocation.args, {
    env: invocation.env,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
  });
  if (result.error) throw new Error(`No se pudo ejecutar Docker: ${result.error.message}`);
  return result;
}

async function quickUrls(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = QUICK_TUNNELS.map((tunnel) => {
      const { stdout = '', stderr = '' } = compose([...tunnelComposeArgs('logs'), tunnel.service], {}, true);
      return { ...tunnel, url: quickTunnelUrl(stdout + stderr) };
    });
    if (found.every((t) => t.url) || Date.now() > deadline) return found;
    await sleep(2_000);
  }
}

/** El DNS de un túnel rápido tarda unos segundos en propagarse: reintenta hasta 60 s. */
async function probe(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let last = 'sin respuesta';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (response.ok) return 'ok';
      last = `HTTP ${response.status}`;
    } catch (err) {
      last = err.cause?.code ?? err.message;
    }
    await sleep(3_000);
  }
  return last;
}

async function printQuickUrls() {
  const tunnels = await quickUrls();
  const lines = [];
  for (const tunnel of tunnels) {
    const status = tunnel.url ? await probe(`${tunnel.url}${tunnel.health}`) : 'sin URL todavía';
    console.log(`${tunnel.label.padEnd(34)} ${tunnel.url ?? '—'}  [${status}]`);
    if (tunnel.url) lines.push(`${tunnel.label}: ${tunnel.url}`);
  }
  const backoffice = tunnels[0].url;
  if (backoffice) {
    console.log(
      `${'API (salud / Swagger si está activo)'.padEnd(34)} ${backoffice}/api/health · ${backoffice}/api/docs`,
    );
    console.log(`${'App del paciente (Ajustes → Servidor)'.padEnd(34)} ${backoffice}`);
    lines.push(`API: ${backoffice}/api`, `App del paciente: ${backoffice}`);
  }
  writeFileSync(resolve('.gateway', 'tunnel-urls.txt'), `${lines.join('\n')}\n`);
  console.log('\nURLs guardadas en .gateway/tunnel-urls.txt. Cambian cada vez que se recrean los túneles.');
}

async function main(action = 'up') {
  const settings = readGatewaySettings();
  const mode = tunnelMode(settings);
  if (action === 'down') {
    process.exitCode = compose(tunnelComposeArgs('down', mode)).status ?? 1;
    return;
  }
  if (action === 'up') {
    if (!settings.GATEWAY_TRUST_PROXY) {
      console.log(
        'TRUST_PROXY=2 mientras haya túnel. gateway:up lo vuelve a 1; fijalo con GATEWAY_TRUST_PROXY=2.',
      );
    }
    const result = compose(tunnelComposeArgs('up', mode), tunnelEnvironment(settings));
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      return;
    }
  }
  if (mode === 'named') {
    console.log('Túnel con nombre activo: las URLs son los hostnames públicos configurados en Cloudflare.');
    return;
  }
  await printQuickUrls();
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('tools/scripts/gateway-tunnel.mjs')) {
  main(process.argv[2]).catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
