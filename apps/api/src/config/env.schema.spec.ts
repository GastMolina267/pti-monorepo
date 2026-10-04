import { validateEnv } from './env.schema';

describe('validateEnv', () => {
  it('aplica valores por defecto', () => {
    const env = validateEnv({});
    expect(env.PORT).toBe(3000);
    expect(env.SWAGGER_ENABLED).toBe(true);
    expect(env.NODE_ENV).toBe('development');
  });

  it('convierte PORT a número', () => {
    expect(validateEnv({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('rechaza una clave AES que no tenga 32 bytes en hex', () => {
    expect(() => validateEnv({ TELEMETRY_AES_KEY: 'corta' })).toThrow(/Variables de entorno inválidas/);
  });
});
