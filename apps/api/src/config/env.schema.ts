import { z } from 'zod';

/**
 * Esquema de variables de entorno de la API. Se valida al arrancar:
 * si falta o es inválida una variable, el proceso no inicia (fail fast).
 * Documentado en `.env.example` (raíz del monorepo).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_VERSION: z.string().default('0.1.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  /** Orígenes permitidos para CORS, separados por coma. */
  CORS_ORIGINS: z.string().default('http://localhost:4200,http://localhost:4300'),
  /** Habilita Swagger UI en /api/docs. */
  SWAGGER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  // --- Fase 1+: persistencia y mensajería (opcionales hasta que se implementen) ---
  DATABASE_URL: z.string().url().optional(),
  MQTT_URL: z.string().optional(),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  /** Clave AES-256 compartida con los wearables: 64 caracteres hex (32 bytes). */
  TELEMETRY_AES_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'Debe ser una clave hex de 64 caracteres (32 bytes)')
    .optional(),
  JWT_SECRET: z.string().min(32).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
