import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { validateEnv } from '../../config/env.schema';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

async function setup(query: jest.Mock) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        load: [() => ({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db', JWT_SECRET: 'x'.repeat(32) })],
        validate: validateEnv,
      }),
    ],
    controllers: [HealthController],
    providers: [HealthService, { provide: getDataSourceToken(), useValue: { query } }],
  }).compile();
  return moduleRef.get(HealthController);
}

describe('HealthController', () => {
  it('responde ok cuando la base responde', async () => {
    const controller = await setup(jest.fn().mockResolvedValue([{ '?column?': 1 }]));
    const res = await controller.get();
    expect(res.status).toBe('ok');
    expect(res.service).toBe('vitalia-api');
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
