import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isMqttPassword,
  MQTT_TOPICS,
  parseWearableCode,
  parseWearableMqttPasswords,
  type WearableMqttPasswords,
} from '@vitalia/contracts';
import { simulatedCode } from '../wearable-simulator/src/lib/wearable';
import { readGatewaySettings } from './gateway-init.mjs';

/** ACL por usuario: no hay patrones globales que otorguen permisos adicionales a API o health. */
export function renderMqttAcl(apiUser: string, healthUser: string, devices: WearableMqttPasswords): string {
  const sections = [
    `user ${apiUser}\ntopic read ${MQTT_TOPICS.allWearableData}\ntopic write ${MQTT_TOPICS.wearableCommand('+', '+')}`,
    `user ${healthUser}\ntopic read $SYS/broker/uptime`,
    ...Object.keys(devices)
      .sort()
      .map(
        (code) =>
          `user ${code}\ntopic write ${MQTT_TOPICS.wearableData('+', code)}\ntopic read ${MQTT_TOPICS.wearableCommand('+', code)}`,
      ),
  ];
  return '# Generado localmente. Denegar cualquier permiso no declarado.\n' + sections.join('\n\n') + '\n';
}

function privateFile(path: string, content: string): void {
  writeFileSync(path, content, { mode: 0o600 });
  chmodSync(path, 0o600);
}

export function configureGatewayMqtt(directory = '.gateway', extraCodes: string[] = []): number {
  for (const code of extraCodes) {
    if (!parseWearableCode(code)) throw new Error('Usá --wearable=wb-<NN>-<mac>');
  }
  const settings = readGatewaySettings(directory);
  const defaults: Record<string, string> = {
    MQTT_USERNAME: 'vitalia-api',
    MQTT_PASSWORD: randomBytes(24).toString('base64url'),
    MQTT_HEALTH_USERNAME: 'vitalia-health',
    MQTT_HEALTH_PASSWORD: randomBytes(24).toString('base64url'),
  };
  const added: string[] = [];
  for (const [name, value] of Object.entries(defaults)) {
    if (settings[name] === undefined) {
      settings[name] = value;
      added.push(`${name}=${value}`);
    }
  }
  const users = [settings.MQTT_USERNAME, settings.MQTT_HEALTH_USERNAME];
  if (users.some((u) => !/^[A-Za-z0-9_-]{1,64}$/.test(u) || parseWearableCode(u)) || users[0] === users[1]) {
    throw new Error('Los usuarios MQTT de API y health deben ser distintos y no ser códigos de pulsera');
  }
  if (!isMqttPassword(settings.MQTT_PASSWORD) || !isMqttPassword(settings.MQTT_HEALTH_PASSWORD)) {
    throw new Error('Las contraseñas MQTT de API y health son inválidas');
  }
  const mqttDirectory = resolve(directory, 'mqtt');
  const deviceFile = resolve(mqttDirectory, 'devices.json');
  mkdirSync(mqttDirectory, { recursive: true });
  let devices: Record<string, string>;
  if (existsSync(deviceFile)) {
    try {
      devices = { ...parseWearableMqttPasswords(JSON.parse(readFileSync(deviceFile, 'utf8'))) };
    } catch {
      throw new Error('No se pudo validar .gateway/mqtt/devices.json; no se reemplazaron sus credenciales');
    }
  } else {
    devices = Object.fromEntries(
      ['wb-01-24d7cc', ...Array.from({ length: 7 }, (_, i) => simulatedCode(i + 2))].map((code) => [
        code,
        randomBytes(24).toString('base64url'),
      ]),
    );
  }
  for (const code of extraCodes) devices[code] ??= randomBytes(24).toString('base64url');
  if (added.length > 0) {
    const file = resolve(directory, '.env');
    privateFile(
      file,
      readFileSync(file, 'utf8').replace(/\s*$/, '\n') +
        '# Identidades del broker del gateway\n' +
        added.join('\n') +
        '\n',
    );
  }
  privateFile(deviceFile, JSON.stringify(devices, null, 2) + '\n');
  privateFile(
    resolve(mqttDirectory, 'users'),
    [
      `${settings.MQTT_USERNAME}:${settings.MQTT_PASSWORD}`,
      `${settings.MQTT_HEALTH_USERNAME}:${settings.MQTT_HEALTH_PASSWORD}`,
      ...Object.entries(devices)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, password]) => `${code}:${password}`),
    ].join('\n') + '\n',
  );
  privateFile(resolve(mqttDirectory, 'acl'), renderMqttAcl(users[0], users[1], devices));
  return Object.keys(devices).length;
}
