import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { MqttService, type MqttStatus } from '../mqtt/mqtt.service';
import { SyncService } from '../sync/sync.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/**
 * ConfigService simulado: los tests unitarios NO deben depender del .env
 * (Nx lo inyecta en las tareas locales, pero en CI no existe).
 */
const env: Record<string, string | undefined> = {
  APP_VERSION: '0.2.0',
  NODE_ENV: 'test',
  TELEMETRY_AES_KEY: 'ab'.repeat(32),
};
const config = { get: (key: string) => env[key] };

async function setup(
  query: jest.Mock,
  mqtt: MqttStatus = { state: 'connected', url: 'mqtt://localhost:1883' },
  sync: { enabled: boolean; status?: () => Promise<unknown> } = { enabled: false },
) {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      HealthService,
      { provide: ConfigService, useValue: config },
      { provide: getDataSourceToken(), useValue: { query } },
      { provide: MqttService, useValue: { status: () => mqtt } },
      { provide: SyncService, useValue: sync },
    ],
  }).compile();
  return moduleRef.get(HealthController);
}

describe('HealthController', () => {
  it('responde ok cuando la base responde', async () => {
    const controller = await setup(jest.fn().mockResolvedValue([{ '?column?': 1 }]));
    const res = await controller.get();
    expect(res).toMatchObject({
      status: 'ok',
      service: 'vitalia-api',
      version: '0.2.0',
      environment: 'test',
    });
    expect(res.checks).toEqual([
      { name: 'process', status: 'ok' },
      { name: 'database', status: 'ok' },
      { name: 'mqtt', status: 'ok' },
    ]);
  });

  it('con la nube caída queda degraded (no down) y cuenta los pendientes', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const res = await (
      await setup(query, undefined, {
        enabled: true,
        status: async () => ({ pending: 12, consecutiveFailures: 3, lastError: 'fetch failed' }),
      })
    ).get();
    expect(res.status).toBe('degraded');
    expect(res.checks[3]).toMatchObject({ name: 'sync', status: 'degraded' });
    expect(res.checks[3].detail).toContain('12 cambio(s)');
  });

  it('marca degraded si MQTT no está configurado o no conecta (los turnos siguen)', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const disabled = await (await setup(query, { state: 'disabled' })).get();
    expect(disabled.status).toBe('degraded');
    expect(disabled.checks[2]).toMatchObject({ name: 'mqtt', status: 'degraded' });

    const down = await (
      await setup(query, { state: 'disconnected', url: 'mqtt://gw:1883', lastError: 'ECONNREFUSED' })
    ).get();
    expect(down.status).toBe('degraded');
    expect(down.checks[2].detail).toContain('ECONNREFUSED');
  });

  it('marca down si PostgreSQL no responde', async () => {
    const controller = await setup(jest.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const res = await controller.get();
    expect(res.status).toBe('down');
    expect(res.checks[1]).toMatchObject({ name: 'database', status: 'down' });
  });
});
