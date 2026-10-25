import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import type { HealthCheck, HealthResponse, ServiceStatus } from '@vitalia/contracts';
import { DataSource } from 'typeorm';
import type { Env } from '../../config/env.schema';
import { MqttService } from '../mqtt/mqtt.service';
import { SyncService } from '../sync/sync.service';

const DB_TIMEOUT_MS = 1500;

@Injectable()
export class HealthService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly mqtt: MqttService,
    private readonly sync: SyncService,
  ) {}

  /**
   * Estado del Edge Gateway. PostgreSQL caído → `down`. MQTT caído o sin configurar →
   * `degraded`: los turnos siguen andando, pero no llegan lecturas ni alertas.
   */
  async check(): Promise<HealthResponse> {
    const checks: HealthCheck[] = [
      { name: 'process', status: 'ok' },
      await this.checkDatabase(),
      this.checkMqtt(),
      ...(this.sync.enabled ? [await this.checkSync()] : []),
    ];
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

  private checkMqtt(): HealthCheck {
    const s = this.mqtt.status();
    if (s.state === 'disabled') {
      return {
        name: 'mqtt',
        status: 'degraded',
        detail: 'MQTT_URL sin configurar: telemetría deshabilitada',
      };
    }
    if (s.state === 'disconnected') {
      return {
        name: 'mqtt',
        status: 'degraded',
        detail: `Sin conexión con ${s.url}${s.lastError ? ` (${s.lastError})` : ''}`,
      };
    }
    if (!this.config.get('TELEMETRY_AES_KEY', { infer: true })) {
      return {
        name: 'mqtt',
        status: 'degraded',
        detail: 'Conectado, pero falta TELEMETRY_AES_KEY: las lecturas se ignoran',
      };
    }
    return { name: 'mqtt', status: 'ok' };
  }

  /** La nube caída no es una falla del gateway (RNF-O2): queda `degraded` y acumula en el outbox. */
  private async checkSync(): Promise<HealthCheck> {
    try {
      const s = await this.sync.status();
      if (s.consecutiveFailures > 0) {
        return {
          name: 'sync',
          status: 'degraded',
          detail: `Sin conexión con la nube: ${s.pending} cambio(s) en espera (${s.lastError ?? 'sin detalle'})`,
        };
      }
      return {
        name: 'sync',
        status: 'ok',
        ...(s.pending ? { detail: `${s.pending} cambio(s) por enviar` } : {}),
      };
    } catch (err) {
      return { name: 'sync', status: 'degraded', detail: (err as Error).message };
    }
  }

  private aggregate(checks: HealthCheck[]): ServiceStatus {
    if (checks.some((c) => c.status === 'down')) return 'down';
    if (checks.some((c) => c.status === 'degraded')) return 'degraded';
    return 'ok';
  }
}
