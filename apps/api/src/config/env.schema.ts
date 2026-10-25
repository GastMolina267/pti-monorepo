import { z } from 'zod';

const bool = (def: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(def)
    .transform((v) => v === 'true');

/**
 * Esquema de variables de entorno de la API. Se valida al arrancar:
 * si falta o es inválida una variable, el proceso no inicia (fail fast).
 * Documentado en `.env.example` (raíz del monorepo).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_VERSION: z.string().default('0.2.0'),
  /**
   * Puerto HTTP de la API. Se llama `API_PORT` y no `PORT` porque Nx carga el `.env` raíz en
   * todas las tareas y el dev-server de Angular usa `PORT` por encima de su configuración:
   * con `PORT=3000`, Backoffice y TV intentarían levantar en el puerto de la API.
   */
  API_PORT: z.coerce.number().int().positive().optional(),
  /** @deprecated Compatibilidad con `.env` viejos: usá `API_PORT`. */
  PORT: z.coerce.number().int().positive().default(3000),
  /** Orígenes permitidos para CORS, separados por coma. */
  CORS_ORIGINS: z.string().default('http://localhost:4200,http://localhost:4300,http://localhost:5173'),
  /** Habilita Swagger UI en /api/docs. */
  SWAGGER_ENABLED: bool('true'),
  /** Zona horaria del hospital (día operativo de los turnos). */
  HOSPITAL_TIMEZONE: z.string().default('America/Argentina/Cordoba'),
  /** Minutos promedio por consulta, para estimar la espera. */
  AVG_CONSULT_MINUTES: z.coerce.number().int().positive().default(12),

  // --- PostgreSQL (TypeORM) ---
  DATABASE_URL: z.string().url('DATABASE_URL debe ser una URL postgresql://…'),
  DB_LOGGING: bool('false'),
  /** Aplica migraciones pendientes al arrancar (útil en el gateway / Docker). */
  DB_RUN_MIGRATIONS: bool('false'),

  // --- Auth del personal ---
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  /** Duración del token en segundos (por defecto, un turno de 8 h). */
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(28800),

  // --- Fase 2: mensajería ---
  MQTT_URL: z.string().optional(),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  /** Clave AES-256 compartida con los wearables: 64 caracteres hex (32 bytes). */
  TELEMETRY_AES_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'Debe ser una clave hex de 64 caracteres (32 bytes)')
    .optional()
    .or(z.literal('').transform(() => undefined)),

  // --- Fase 5: operación de largo plazo ---
  /**
   * `trust proxy` de Express. Detrás de Nginx (gateway) tiene que ser `1`: si no, todos los
   * pedidos llegan con la IP del proxy y los límites de login y check-in se comparten entre
   * todos. Acepta un número de saltos, `true`/`false` o una lista (`loopback, uniquelocal`).
   */
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((v): boolean | number | string | undefined => {
      if (v === undefined || v === '') return undefined;
      if (v === 'true' || v === 'false') return v === 'true';
      return /^\d+$/.test(v) ? Number(v) : v;
    }),
  /** Horas que se conservan las lecturas de telemetría (0 = no borrar nunca). */
  TELEMETRY_RETENTION_HOURS: z.coerce.number().int().min(0).default(72),
  /** Cada cuántos minutos corre la limpieza de lecturas viejas. */
  TELEMETRY_RETENTION_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  /** Identificador de este gateway en la nube (sync). */
  GATEWAY_ID: z.string().min(1).default('gateway-local'),
  /** Endpoint de la nube que recibe los lotes del outbox. Vacío: sync deshabilitado. */
  CLOUD_SYNC_URL: z
    .url('CLOUD_SYNC_URL debe ser una URL http(s)://…')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  /** Token Bearer para la nube. */
  CLOUD_SYNC_TOKEN: z.string().optional(),
  /** Segundos entre envíos cuando la nube responde (con cortes, espera más, hasta 5 min). */
  CLOUD_SYNC_INTERVAL_SECONDS: z.coerce.number().int().positive().default(15),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
