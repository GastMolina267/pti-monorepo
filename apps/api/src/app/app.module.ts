import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from '../config/env.schema';
import { DatabaseModule } from '../database/database.module';
import { AlertsModule } from '../modules/alerts/alerts.module';
import { AuthModule } from '../modules/auth/auth.module';
import { CatalogModule } from '../modules/catalog/catalog.module';
import { CheckInModule } from '../modules/check-in/check-in.module';
import { HealthModule } from '../modules/health/health.module';
import { MqttModule } from '../modules/mqtt/mqtt.module';
import { PatientModule } from '../modules/patient/patient.module';
import { RealtimeModule } from '../modules/realtime/realtime.module';
import { SyncModule } from '../modules/sync/sync.module';
import { TelemetryModule } from '../modules/telemetry/telemetry.module';
import { TicketsModule } from '../modules/tickets/tickets.module';
import { WearablesModule } from '../modules/wearables/wearables.module';

/**
 * Módulo raíz del backend único (monolito modular) del Edge Gateway.
 * Cada dominio vive en `src/modules/<dominio>` (ver apps/api/AGENTS.md).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['apps/api/.env', '.env'],
      validate: validateEnv,
    }),
    // Límite global generoso; endpoints sensibles (login, check-in) lo ajustan con @Throttle.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    DatabaseModule,
    RealtimeModule,
    MqttModule,
    SyncModule,
    AuthModule,
    HealthModule,
    CatalogModule,
    TicketsModule,
    CheckInModule,
    WearablesModule,
    AlertsModule,
    PatientModule,
    TelemetryModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
