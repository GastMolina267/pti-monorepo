/**
 * DataSource de TypeORM para el CLI de migraciones y el seed
 * (targets de Nx: db-migrate, db-generate, db-revert, db-seed, db-reset).
 * Carga el .env de la raíz del monorepo si existe.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './options';

for (const file of ['.env', '../../.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    /* el archivo no existe: se usan las variables del entorno */
  }
}

export default new DataSource(
  buildDataSourceOptions(
    process.env['DATABASE_URL'] ?? 'postgresql://vitalia:vitalia@localhost:5432/vitalia',
    {
      logging: process.env['DB_LOGGING'] === 'true',
    },
  ),
);
