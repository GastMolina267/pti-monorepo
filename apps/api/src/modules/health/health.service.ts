import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import type { HealthCheck, HealthResponse, ServiceStatus } from '@vitalia/contracts';
import { DataSource } from 'typeorm';
import type { Env } from '../../config/env.schema';

const DB_TIMEOUT_MS = 1500;

@Injectable()
export class HealthService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Estado del Edge Gateway. En la Fase 2 se suma el check de MQTT. */
  async check(): Promise<HealthResponse> {
    const checks: HealthCheck[] = [{ name: 'process', status: 'ok' }, await this.checkDatabase()];
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

  private async checkDatabase(): Promise<HealthCheck> {
    try {
      await Promise.race([
        this.dataSource.query('SELECT 1'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS)),
      ]);
      return { name: 'database', status: 'ok' };
    } catch (err) {
      return {
        name: 'database',
        status: 'down',
        detail: `PostgreSQL no responde (${(err as Error).message})`,
      };
    }
  }

  private aggregate(checks: HealthCheck[]): ServiceStatus {
    if (checks.some((c) => c.status === 'down')) return 'down';
    if (checks.some((c) => c.status === 'degraded')) return 'degraded';
    return 'ok';
  }
}
