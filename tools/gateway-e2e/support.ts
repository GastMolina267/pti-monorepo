import {
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
  type WebSocketRoute,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { connectAsync, type MqttClient } from 'mqtt';
import {
  API_PREFIX,
  composeSeq,
  MQTT_QOS,
  MQTT_TOPICS,
  splitSeq,
  type Alert,
  type CheckInResponse,
  type LoginResponse,
  type TelemetryReading,
  type Wearable,
  type WearableCommand,
} from '@vitalia/contracts';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import {
  connectionCredentials,
  gatewayEnvironment,
  loadDevicePasswords,
} from '../wearable-simulator/src/lib/credentials';
import { gatewayHost } from '../wearable-simulator/src/lib/gateway-host';
import { parseKey, sealReading } from '../wearable-simulator/src/lib/envelope';
import { BootStore } from '../wearable-simulator/src/lib/boot-store';
import { nextBoot } from '../wearable-simulator/src/lib/wearable';
import { cleanupFixtures, FixtureJournal, runMarker } from '../scripts/gateway-fixtures';

export const settings = parseEnv(readFileSync('.gateway/.env', 'utf8'));
const httpHost = gatewayHost(settings.GATEWAY_HTTP_BIND);
export const backofficeOrigin = `http://${httpHost}:${settings.GATEWAY_HTTP_PORT}`;
export const tvOrigin = `http://${httpHost}:${settings.GATEWAY_TV_PORT}`;

/** REST real a través de Nginx; los errores no imprimen tokens, credenciales ni bodies. */
export class GatewayApi {
  private journal?: FixtureJournal;
  constructor(readonly request: APIRequestContext) {}
  async call<T>(method: string, path: string, data?: unknown): Promise<T> {
    const response = await this.request.fetch(`${backofficeOrigin}/${API_PREFIX}${path}`, { method, data });
    expect(response.ok(), `${method} ${path}: HTTP ${response.status()}`).toBeTruthy();
    return response.json() as Promise<T>;
  }
  async checkIn(reason: string): Promise<CheckInResponse> {
    if (!this.journal) {
      this.journal = new FixtureJournal();
      console.log(`Corrida recuperable: ${this.journal.run.id}`);
    }
    delete this.journal.run.cleanedAt;
    this.journal.save();
    const ticket = await this.call<CheckInResponse>('POST', '/check-in', {
      firstName: 'Prueba',
      lastName: 'Integración',
      source: 'KIOSK',
      serviceCode: 'CLINICA',
      reason: `${runMarker(this.journal.run.id)} ${reason}`,
    });
    this.journal.remember(ticket.id);
    return ticket;
  }
  wearable(id: string): Promise<Wearable> {
    return this.call('GET', `/wearables/${id}`);
  }
  async alert(ticketId: string, kind: Alert['kind']): Promise<Alert> {
    let found: Alert | undefined;
    await expect
      .poll(
        async () => {
          found = (await this.call<Alert[]>('GET', '/alerts')).find(
            (a) => a.ticketId === ticketId && a.kind === kind,
          );
          return !!found;
        },
        { message: `Persistencia de alerta ${kind}` },
      )
      .toBe(true);
    return found!;
  }
  /** Solo reconoce/cierra los recursos creados por esta corrida; conserva el seed y el historial. */
  async cleanup(): Promise<void> {
    if (this.journal) await cleanupFixtures(this.journal, this.call.bind(this));
  }
}

export async function login(page: Page): Promise<LoginResponse> {
  await page.goto(`${backofficeOrigin}/login`);
  await page.getByLabel('Email', { exact: true }).fill('admin@vitalia.local');
  // Evita que un error de locator.fill copie la contraseña a los logs de Playwright.
  await page.getByLabel('Contraseña', { exact: true }).evaluate((element, password) => {
    (element as HTMLInputElement).value = password;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, settings.SEED_PASSWORD);
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  const result = await response;
  expect(result.status(), 'Login con el seed del gateway').toBe(200);
  await expect(page.locator('header.topbar .conn')).toHaveText('En vivo');
  if (await page.getByRole('alertdialog').isVisible())
    await page.getByRole('button', { name: 'Minimizar', exact: true }).click();
  return result.json() as Promise<LoginResponse>;
}

/** Corta HTTP y WebSocket de un solo navegador; Node/REST y Mosquitto siguen operativos. */
export async function networkGate(context: BrowserContext): Promise<(offline: boolean) => Promise<void>> {
  let offline = false;
  const sockets: [WebSocketRoute, WebSocketRoute][] = [];
  await context.routeWebSocket(/\/socket\.io\//, (client) => {
    if (offline) {
      void client.close();
      return;
    }
    sockets.push([client, client.connectToServer()]);
  });
  return async (value: boolean) => {
    offline = value;
    if (offline)
      for (const [client, server] of sockets.splice(0)) await Promise.all([client.close(), server.close()]);
    await context.setOffline(value);
  };
}

export class TestWearable {
  readonly commands: { topic: string; value: WearableCommand }[] = [];
  readonly room = 'e2e-4d';
  private client?: MqttClient;
  private counter = 0;
  private readonly boot: number;
  private readonly environment = gatewayEnvironment();
  private readonly passwords = loadDevicePasswords(this.environment.MQTT_CREDENTIALS_FILE);
  private readonly key = parseKey(this.environment.TELEMETRY_AES_KEY);
  constructor(readonly wearable: Wearable) {
    const store = new BootStore();
    this.boot = nextBoot(
      Date.now(),
      Math.max(store.load() ?? 0, splitSeq(wearable.lastReading?.seq ?? 0).boot),
    );
    store.save(this.boot);
  }
  static async available(api: GatewayApi): Promise<TestWearable> {
    const passwords = loadDevicePasswords(gatewayEnvironment().MQTT_CREDENTIALS_FILE)!;
    const alerts = await api.call<Alert[]>('GET', '/alerts');
    const available = (await api.call<Wearable[]>('GET', '/wearables')).find(
      (w) =>
        /^wb-0[2-8]-5e000[2-8]$/.test(w.code) &&
        passwords[w.code] &&
        w.status === 'AVAILABLE' &&
        !w.ticket &&
        (!w.online || w.room === 'e2e-4d') &&
        !alerts.some((a) => a.wearableId === w.code),
    );
    expect(
      available,
      'Necesitás una pulsera simulada 02–08 libre, sin emisor ni alertas activas',
    ).toBeDefined();
    return new TestWearable(available!);
  }
  async connect(): Promise<void> {
    this.client = await connectAsync(this.environment.MQTT_URL, {
      ...connectionCredentials(this.wearable.code, this.passwords, {}),
      clientId: `e2e-${randomUUID()}`,
      reconnectPeriod: 0,
      connectTimeout: 5000,
    });
    this.client.on('message', (topic, data) =>
      this.commands.push({ topic, value: JSON.parse(data.toString()) as WearableCommand }),
    );
    await this.client.subscribeAsync(MQTT_TOPICS.wearableCommand('+', this.wearable.code), { qos: MQTT_QOS });
  }
  async publish(values: Partial<TelemetryReading> = {}): Promise<number> {
    const seq = composeSeq(this.boot, this.counter++);
    const reading: TelemetryReading = {
      hr: 77,
      spo2: 98,
      temp: 36.7,
      accPeakG: 1,
      fall: false,
      ...values,
      wearableId: this.wearable.code,
      ts: Date.now(),
      seq,
    };
    await this.client!.publishAsync(
      MQTT_TOPICS.wearableData(this.room, this.wearable.code),
      JSON.stringify(sealReading(reading, this.key)),
      { qos: MQTT_QOS },
    );
    return seq;
  }
  async close(): Promise<void> {
    await this.client?.endAsync(true);
    this.client = undefined;
  }
}
