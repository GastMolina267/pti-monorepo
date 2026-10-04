import { validateEnv } from './env.schema';

const required = {
  DATABASE_URL: 'postgresql://vitalia:vitalia@localhost:5432/vitalia',
  JWT_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('aplica valores por defecto', () => {
    const env = validateEnv(required);
    expect(env.PORT).toBe(3000);
    expect(env.SWAGGER_ENABLED).toBe(true);
    expect(env.DB_RUN_MIGRATIONS).toBe(false);
    expect(env.JWT_EXPIRES_IN_SECONDS).toBe(28800);
  });

  it('convierte PORT a número', () => {
    expect(validateEnv({ ...required, PORT: '8080' }).PORT).toBe(8080);
  });

  it('exige DATABASE_URL y un JWT_SECRET largo', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ ...required, JWT_SECRET: 'corto' })).toThrow(/32 caracteres/);
  });

  it('acepta TELEMETRY_AES_KEY vacía y rechaza una inválida', () => {
    expect(validateEnv({ ...required, TELEMETRY_AES_KEY: '' }).TELEMETRY_AES_KEY).toBeUndefined();
    expect(() => validateEnv({ ...required, TELEMETRY_AES_KEY: 'corta' })).toThrow(
      /Variables de entorno inválidas/,
    );
  });
});
