# AGENTS.md — apps/api (Vitalia API · NestJS 11 + TypeORM)

Backend **único** del Edge Gateway (monolito modular). Sirve REST a Backoffice, TV y portal cautivo; en la Fase 2 suma MQTT (wearables) y Socket.IO (tiempo real). Persiste en PostgreSQL 16 con TypeORM. Reglas generales en el [AGENTS.md raíz](../../AGENTS.md).

## Estructura

```
src/
  main.ts                    # bootstrap: /api, CORS, ValidationPipe (common/validation.ts), Swagger /api/docs
  app/app.module.ts          # Config global, Throttler, Database y módulos de dominio
  config/env.schema.ts       # zod: TODAS las variables de entorno (fail fast)
  common/
    auth/                    # @Public(), @Roles(), @CurrentUser(), JwtAuthGuard y RolesGuard (globales)
    time/day-key.ts          # día operativo en hora de Argentina
    validation.ts            # ValidationPipe compartido (app y tests)
  database/
    database.module.ts       # TypeOrmModule.forRootAsync
    options.ts               # opciones compartidas (app, CLI, seed, tests)
    data-source.ts           # DataSource del CLI de migraciones
    entities.ts              # REGISTRO de entidades (sin globs)
    migrations/              # migraciones + index.ts (REGISTRO, en orden)
    seeds/                   # seed.ts (idempotente, datos simulados) + run-seed.ts
  modules/
    health/                  # GET /health (+ check de PostgreSQL)              ✅ F0–F1
    auth/                    # login JWT, /auth/me, entidad StaffUser           ✅ F1
    catalog/                 # servicios y consultorios                         ✅ F1
    tickets/                 # pacientes, turnos, fila, llamado, estados        ✅ F1
    check-in/                # POST /check-in público (rate limit)              ✅ F1
    iomt/entities/           # Wearable, TelemetryReading, Alert (tablas listas para la F2)
    # Fase 2: realtime (Socket.IO), telemetry (MQTT + AES-GCM), alerts, wearables
  app.int.spec.ts            # integración contra PostgreSQL (requiere TEST_DATABASE_URL)
```

Cada módulo de dominio sigue esta forma (skill `vitalia-nest-module`):

```
modules/<dominio>/
  <dominio>.module.ts / .controller.ts / .service.ts
  <dominio>.mapper.ts          # entidad → contrato de @vitalia/contracts
  dto/                         # class-validator (mensajes en español) + @ApiProperty, implements contratos
  entities/                    # entidades TypeORM del dominio (skill vitalia-database)
  *.spec.ts
```

## Reglas

- **Seguridad por defecto:** el `JwtAuthGuard` es **global**, así que todo endpoint es privado. Solo se abre con `@Public()`, que va únicamente en health, login, servicios, check-in y la vista pública del turno. Los permisos por rol van con `@Roles(...)` (constantes `ROLES_CAN_*` de contracts).
- **Configuración:** agregá cada variable nueva a `config/env.schema.ts` **y** a `.env.example`. Leela con `ConfigService<Env, true>` y `{ infer: true }`. Nunca uses `process.env.X` en código de dominio.
- **Persistencia:** TypeORM con `synchronize: false`. Cualquier cambio de esquema pasa por una migración (skill `vitalia-database`). Las entidades se registran en `database/entities.ts`.
- **Respuestas:** nunca devuelvas entidades. Mapealas a los contratos con un `*.mapper.ts`. Los datos del paciente se minimizan (`displayName`, nunca el DNI).
- **Contratos:** los DTOs hacen `implements` de `@vitalia/contracts`. Eventos, tópicos y reglas (transiciones, orden de fila) se importan de ahí, sin duplicarlos.
- **Validación:** `ValidationPipe` global con `whitelist` y `forbidNonWhitelisted`. Los mensajes van en español en cada decorador (el portal los muestra tal cual).
- **Rate limit:** `ThrottlerGuard` global (300/min). Endpoints sensibles con `@Throttle` (login 5/min, check-in 10/min).
- **Latencia:** REST de turnos < 50 ms (hoy ~5 ms p50). En la Fase 2, nada bloqueante en el camino MQTT → WS.
- **Errores:** excepciones de Nest con mensaje en español (`NotFoundException('Turno no encontrado')`, `ConflictException` para transiciones inválidas).
- **Tests:** jest. Unitarios con mocks. El flujo completo va en `app.int.spec.ts` contra PostgreSQL real (CI con service container). ⚠️ Jest corre en CommonJS: **no uses dependencias solo-ESM** en código que se testea (ej. `@faker-js/faker` v10).
- **Los tests no pueden depender del `.env`.** Nx carga el `.env` de la raíz en cada tarea local, pero en CI no existe. En los unitarios usá un `ConfigService` simulado (`{ provide: ConfigService, useValue: { get } }`), no `ConfigModule.forRoot({ load })`: la validación de `@nestjs/config` mira las variables de entorno y no los valores de `load`. Para reproducir la CI: `mv .env .env.bak && pnpm nx test api`.

## Comandos

```bash
pnpm nx serve api                 # http://localhost:3000/api · Swagger /api/docs
pnpm nx test api                  # + TEST_DATABASE_URL=... para la integración
pnpm db:migrate | db:generate --name=X | db:revert | db:show | db:seed | db:reset
```
