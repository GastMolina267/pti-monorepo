import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readGatewaySettings } from './gateway-init.mjs';

/** El .env de desarrollo que carga Nx no puede reemplazar los secretos del gateway. */
export function gatewayComposeInvocation(args, environment = process.env, directory = '.gateway') {
  return {
    args: ['compose', '--env-file', resolve(directory, '.env'), '-f', 'docker-compose.gateway.yml', ...args],
    env: { ...environment, ...readGatewaySettings(directory) },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const invocation = gatewayComposeInvocation(process.argv.slice(2));
  const result = spawnSync('docker', invocation.args, { env: invocation.env, stdio: 'inherit' });
  if (result.error) console.error('No se pudo ejecutar Docker:', result.error.message);
  process.exitCode = result.status ?? 1;
}
