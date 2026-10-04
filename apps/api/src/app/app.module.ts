import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from '../config/env.schema';
import { HealthModule } from '../modules/health/health.module';

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
    HealthModule,
  ],
})
export class AppModule {}
