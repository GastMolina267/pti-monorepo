import type { DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities';
import { MIGRATIONS } from './migrations';

/** Opciones de TypeORM compartidas por la API (DatabaseModule), el CLI y el seed. */
export function buildDataSourceOptions(
  url: string,
  opts: { logging?: boolean; migrationsRun?: boolean } = {},
): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    // gen_random_uuid() es nativo desde PostgreSQL 13: no requiere extensiones ni superusuario.
    uuidExtension: 'pgcrypto',
    installExtensions: false,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    migrationsTableName: 'typeorm_migrations',
    migrationsRun: opts.migrationsRun ?? false,
    synchronize: false,
    logging: opts.logging ? ['query', 'error'] : ['error'],
  };
}
