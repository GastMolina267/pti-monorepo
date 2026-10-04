import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/**
 * ConfigService simulado: los tests unitarios NO deben depender del .env
 * (Nx lo inyecta en las tareas locales, pero en CI no existe).
 */
const config = { get: (key: string) => ({ APP_VERSION: '0.2.0', NODE_ENV: 'test' })[key] };

async function setup(query: jest.Mock) {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      HealthService,
      { provide: ConfigService, useValue: config },
      { provide: getDataSourceToken(), useValue: { query } },
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
    ]);
  });

  it('marca down si PostgreSQL no responde', async () => {
    const controller = await setup(jest.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const res = await controller.get();
    expect(res.status).toBe('down');
    expect(res.checks[1]).toMatchObject({ name: 'database', status: 'down' });
  });
});
