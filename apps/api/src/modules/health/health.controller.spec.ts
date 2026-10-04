import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { validateEnv } from '../../config/env.schema';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true, validate: validateEnv })],
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  it('responde ok con el contrato HealthResponse', () => {
    const res = controller.get();
    expect(res.status).toBe('ok');
    expect(res.service).toBe('vitalia-api');
    expect(res.version).toBe('0.1.0');
    expect(res.checks).toContainEqual({ name: 'process', status: 'ok' });
    expect(() => new Date(res.timestamp).toISOString()).not.toThrow();
  });
});
