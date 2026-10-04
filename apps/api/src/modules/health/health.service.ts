import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HealthCheck, HealthResponse, ServiceStatus } from '@vitalia/contracts';
import type { Env } from '../../config/env.schema';

@Injectable()
export class HealthService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  /**
   * Estado del Edge Gateway. En Fase 1 se agrega el check de PostgreSQL y en
   * Fase 2 el de Mosquitto (MQTT); el estado global es el peor de los checks.
   */
  check(): HealthResponse {
    const checks: HealthCheck[] = [{ name: 'process', status: 'ok' }];
    return {
      status: this.aggregate(checks),
      service: 'vitalia-api',
      version: this.config.get('APP_VERSION', { infer: true }),
      environment: this.config.get('NODE_ENV', { infer: true }),
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private aggregate(checks: HealthCheck[]): ServiceStatus {
    if (checks.some((c) => c.status === 'down')) return 'down';
    if (checks.some((c) => c.status === 'degraded')) return 'degraded';
    return 'ok';
  }
}
