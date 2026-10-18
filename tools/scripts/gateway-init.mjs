import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

/** Crea credenciales locales sin sobrescribir una instalación ni imprimir secretos. */
export function initializeGateway(directory = '.gateway') {
  const file = resolve(directory, '.env');
  mkdirSync(directory, { recursive: true });
  const settings = {
    POSTGRES_PASSWORD: randomBytes(24).toString('base64url'),
    JWT_SECRET: randomBytes(48).toString('base64url'),
    TELEMETRY_AES_KEY: randomBytes(32).toString('hex'),
    SEED_PASSWORD: randomBytes(18).toString('base64url'),
    GATEWAY_HTTP_PORT: '8080',
    GATEWAY_TV_PORT: '8081',
    GATEWAY_MQTT_PORT: '1884',
  };
  const content =
    '# Configuración local del gateway; no versionar ni compartir.\n' +
    Object.entries(settings)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') +
    '\n';
  try {
    writeFileSync(file, content, { flag: 'wx', mode: 0o600 });
    return { created: true, file };
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    return { created: false, file };
  }
}

export function readGatewaySettings(directory = '.gateway') {
  return parseEnv(readFileSync(resolve(directory, '.env'), 'utf8'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = initializeGateway();
  console.log(
    result.created ? 'Configuración creada en .gateway/.env' : 'Se conserva .gateway/.env existente',
  );
}
