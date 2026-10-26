import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { parseWearableMqttPasswords, type WearableMqttPasswords } from '@vitalia/contracts';
import { UsageError } from './cli';
import { gatewayHost } from './gateway-host';

/** El gateway usa su propia clave y archivo de dispositivos; nunca las credenciales de la API. */
export function gatewayEnvironment(directory = '.gateway'): Record<string, string> {
  try {
    const settings = parseEnv(readFileSync(resolve(directory, '.env'), 'utf8'));
    return {
      MQTT_URL: `mqtt://${gatewayHost(settings.GATEWAY_MQTT_BIND)}:${settings.GATEWAY_MQTT_PORT ?? '1884'}`,
      TELEMETRY_AES_KEY: settings.TELEMETRY_AES_KEY ?? '',
      MQTT_CREDENTIALS_FILE: resolve(directory, 'mqtt/devices.json'),
      MQTT_USERNAME: '',
      MQTT_PASSWORD: '',
    };
  } catch {
    throw new UsageError('No se pudo leer la configuración del gateway; ejecutá pnpm gateway:up');
  }
}

export function loadDevicePasswords(file?: string): WearableMqttPasswords | undefined {
  if (file === undefined) return undefined;
  try {
    return parseWearableMqttPasswords(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    throw new UsageError('No se pudo validar el archivo de credenciales MQTT');
  }
}

export function connectionCredentials(
  code: string,
  devices: WearableMqttPasswords | undefined,
  fallback: { username?: string; password?: string },
): { username?: string; password?: string } {
  if (devices === undefined) return fallback;
  const password = devices[code];
  if (!password)
    throw new UsageError(`Faltan credenciales MQTT para ${code}; aprovisionalas antes de simular`);
  return { username: code, password };
}
