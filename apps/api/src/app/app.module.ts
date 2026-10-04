import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from '../config/env.schema';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../modules/auth/auth.module';
import { CatalogModule } from '../modules/catalog/catalog.module';
import { CheckInModule } from '../modules/check-in/check-in.module';
import { HealthModule } from '../modules/health/health.module';
import { TicketsModule } from '../modules/tickets/tickets.module';

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
    AuthModule,
    HealthModule,
    CatalogModule,
    TicketsModule,
    CheckInModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
