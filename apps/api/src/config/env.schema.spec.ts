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

  it('acepta API_PORT (el nombre recomendado)', () => {
    expect(validateEnv({ ...required, API_PORT: '3100' }).API_PORT).toBe(3100);
  });

  it('interpreta TRUST_PROXY como saltos, booleano o lista', () => {
    expect(validateEnv(required).TRUST_PROXY).toBeUndefined();
    expect(validateEnv({ ...required, TRUST_PROXY: '1' }).TRUST_PROXY).toBe(1);
    expect(validateEnv({ ...required, TRUST_PROXY: 'false' }).TRUST_PROXY).toBe(false);
    expect(validateEnv({ ...required, TRUST_PROXY: 'loopback, uniquelocal' }).TRUST_PROXY).toBe(
      'loopback, uniquelocal',
    );
  });

  it('retención y sync con valores por defecto seguros', () => {
    const env = validateEnv(required);
    expect(env.TELEMETRY_RETENTION_HOURS).toBe(72);
    expect(env.CLOUD_SYNC_URL).toBeUndefined();
    expect(validateEnv({ ...required, CLOUD_SYNC_URL: '' }).CLOUD_SYNC_URL).toBeUndefined();
    expect(() => validateEnv({ ...required, CLOUD_SYNC_URL: 'no-es-url' })).toThrow(/CLOUD_SYNC_URL/);
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
