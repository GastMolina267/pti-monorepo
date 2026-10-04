/**
 * Ejecuta el seed de desarrollo:  pnpm db:seed
 * Requiere la base migrada (pnpm db:migrate). Nunca se ejecuta en producción.
 */
import dataSource from '../data-source';
import { DEV_PASSWORD, seed } from './seed';

async function main() {
  if (process.env['NODE_ENV'] === 'production' && process.env['SEED_ALLOW_PRODUCTION'] !== 'true') {
    throw new Error('El seed carga datos simulados: no se ejecuta con NODE_ENV=production');
  }
  await dataSource.initialize();
  try {
    const summary = await seed(dataSource, {
      password: process.env['SEED_PASSWORD'] || undefined,
      timeZone: process.env['HOSPITAL_TIMEZONE'],
    });
    console.log('✔ Seed aplicado:', summary);
    console.log(
      `  Usuarios: admin|enfermeria|medico|pediatria|recepcion @vitalia.local · clave: ${process.env['SEED_PASSWORD'] ? '(SEED_PASSWORD)' : DEV_PASSWORD}`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error('✖ Error en el seed:', err);
  process.exit(1);
});
