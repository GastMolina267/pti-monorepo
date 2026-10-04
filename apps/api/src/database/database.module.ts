import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Env } from '../config/env.schema';
import { buildDataSourceOptions } from './options';

/** Conexión a PostgreSQL (TypeORM). Las migraciones se aplican con `pnpm db:migrate`. */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        buildDataSourceOptions(config.get('DATABASE_URL', { infer: true }), {
          logging: config.get('DB_LOGGING', { infer: true }),
          migrationsRun: config.get('DB_RUN_MIGRATIONS', { infer: true }),
        }),
    }),
  ],
})
export class DatabaseModule {}
