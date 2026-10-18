import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { MqttService, type MqttStatus } from '../mqtt/mqtt.service';
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
) {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      HealthService,
      { provide: ConfigService, useValue: config },
      { provide: getDataSourceToken(), useValue: { query } },
      { provide: MqttService, useValue: { status: () => mqtt } },
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
