import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { connectAsync, type MqttClient } from 'mqtt';
import { MQTT_QOS, MQTT_TOPICS, type WearableCommand } from '@vitalia/contracts';
import {
  connectionCredentials,
  gatewayEnvironment,
  loadDevicePasswords,
} from '../wearable-simulator/src/lib/credentials';
import { simulatedCode } from '../wearable-simulator/src/lib/wearable';
import { readGatewaySettings } from './gateway-init.mjs';

const clients: MqttClient[] = [];
const probe = randomUUID();
const room = `acl-${probe}`;
const url = gatewayEnvironment().MQTT_URL;
const settings = readGatewaySettings();

async function bounded<T>(operation: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Tiempo agotado en la prueba MQTT')), 8000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function authorizedError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error.code === 134 || error.code === 135);
}

async function connect(credentials: { username?: string; password?: string }): Promise<MqttClient> {
  const client = await connectAsync(url, {
    ...credentials,
    protocolVersion: 5,
    clientId: `acl-${randomUUID()}`,
    reconnectPeriod: 0,
    connectTimeout: 5000,
  });
  clients.push(client);
  return client;
}

function observe(client: MqttClient): string[] {
  const received: string[] = [];
  client.on('message', (topic, payload) => {
    if (payload.toString().includes(probe)) received.push(topic);
  });
  return received;
}

async function denied(client: MqttClient, topic: string): Promise<void> {
  await assert.rejects(
    bounded(client.publishAsync(topic, JSON.stringify({ probe }), { qos: MQTT_QOS })),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 135,
  );
}

async function delivered(received: string[], topic: string): Promise<void> {
  for (let i = 0; i < 50 && !received.includes(topic); i++) await delay(100);
  assert.ok(received.includes(topic), `No se entregó el mensaje autorizado: ${topic}`);
}

async function main(): Promise<void> {
  await assert.rejects(connect({}), authorizedError);
  await assert.rejects(
    connect({ username: settings.MQTT_USERNAME, password: randomUUID() }),
    authorizedError,
  );
  console.log('MQTT OK: anónimos y contraseñas incorrectas rechazados');

  const devices = loadDevicePasswords(gatewayEnvironment().MQTT_CREDENTIALS_FILE);
  const codeA = simulatedCode(2);
  const codeB = simulatedCode(3);
  const api = await connect({ username: settings.MQTT_USERNAME, password: settings.MQTT_PASSWORD });
  const health = await connect({
    username: settings.MQTT_HEALTH_USERNAME,
    password: settings.MQTT_HEALTH_PASSWORD,
  });
  const wearableA = await connect(connectionCredentials(codeA, devices, {}));
  const wearableB = await connect(connectionCredentials(codeB, devices, {}));
  const apiMessages = observe(api);
  const healthMessages = observe(health);
  const messagesA = observe(wearableA);
  const messagesB = observe(wearableB);
  // Mosquitto puede aceptar un filtro amplio y filtrar cada entrega: SUBACK no prueba aislamiento.
  for (const client of clients) await bounded(client.subscribeAsync('hospital/#', { qos: MQTT_QOS }));
  await bounded(wearableB.subscribeAsync(MQTT_TOPICS.wearableCommand(room, codeB), { qos: MQTT_QOS }));
  const dataA = MQTT_TOPICS.wearableData(room, codeA);
  const dataB = MQTT_TOPICS.wearableData(room, codeB);
  const commandA = MQTT_TOPICS.wearableCommand(room, codeA);
  const commandB = MQTT_TOPICS.wearableCommand(room, codeB);
  const command: WearableCommand = { type: 'SHOW_TICKET', ticketCode: 'ACL-TEST', consultingRoom: probe };
  await bounded(api.publishAsync(commandA, JSON.stringify(command), { qos: MQTT_QOS }));
  await bounded(api.publishAsync(commandB, JSON.stringify(command), { qos: MQTT_QOS }));
  await delivered(messagesA, commandA);
  await delivered(messagesB, commandB);
  // El sobre de prueba no es telemetría clínica: la API lo descarta sin persistir.
  await bounded(wearableA.publishAsync(dataA, JSON.stringify({ probe }), { qos: MQTT_QOS }));
  await bounded(wearableB.publishAsync(dataB, JSON.stringify({ probe }), { qos: MQTT_QOS }));
  await delivered(apiMessages, dataA);
  await delivered(apiMessages, dataB);
  await delay(350);
  assert.deepEqual([...new Set(messagesA)], [commandA], 'La pulsera A recibió un tópico ajeno');
  assert.deepEqual([...new Set(messagesB)], [commandB], 'La pulsera B recibió un tópico ajeno');
  assert.ok(
    apiMessages.every((topic) => topic === dataA || topic === dataB),
    'La API recibió comandos',
  );
  assert.deepEqual(healthMessages, [], 'Health recibió mensajes del hospital');
  console.log('MQTT OK: entregas autorizadas y aislamiento de lectura entre pulseras, API y health');

  await denied(wearableA, dataB);
  await denied(wearableB, dataA);
  await denied(wearableA, commandA);
  await denied(wearableA, commandB);
  await denied(api, dataA);
  await denied(health, dataA);
  await denied(health, commandA);
  console.log('MQTT OK: escrituras cruzadas y permisos de servicio excedidos rechazados con PUBACK 0x87');
}

main()
  .catch((error: unknown) => {
    console.error('Falló la seguridad MQTT:', error instanceof Error ? error.message : 'error desconocido');
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all(clients.map((client) => client.endAsync(true)));
  });
