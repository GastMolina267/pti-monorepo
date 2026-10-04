# AGENTS.md — apps/api (Vitalia API · NestJS 11)

Backend **único** del Edge Gateway (monolito modular). Sirve REST a Backoffice, TV y portal cautivo, consume MQTT de los wearables, emite eventos en tiempo real por Socket.IO y persiste en PostgreSQL. Reglas generales en el [AGENTS.md raíz](../../AGENTS.md).

## Estructura

```
src/
  main.ts                 # bootstrap: prefijo /api, CORS, ValidationPipe, Swagger /api/docs
  app/app.module.ts       # módulo raíz: ConfigModule global + módulos de dominio
  config/env.schema.ts    # zod: TODAS las variables de entorno (fail fast)
  modules/
    health/               # GET /api/health  ✅ (Fase 0)
    # Fase 1: database (Prisma), auth (staff JWT), patients, tickets (turnos), rooms (consultorios)
    # Fase 2: telemetry (MQTT + AES), alerts, realtime (Socket.IO gateway), wearables
    # Fase 5: sync (cola de réplica a la nube)
```

Cada módulo de dominio tiene esta forma (skill `vitalia-nest-module`):

```
modules/<dominio>/
  <dominio>.module.ts
  <dominio>.controller.ts      # solo HTTP: valida, delega, documenta Swagger
  <dominio>.service.ts         # lógica de negocio
  dto/                         # clases con class-validator + @ApiProperty (implementan tipos de @vitalia/contracts)
  <dominio>.controller.spec.ts / <dominio>.service.spec.ts
```

## Reglas

- **Configuración:** agregá cada variable nueva a `config/env.schema.ts` **y** a `.env.example`. Leela con `ConfigService<Env, true>` y `{ infer: true }`. Nunca `process.env.X` en código de dominio.
- **Contratos:** las respuestas implementan interfaces de `@vitalia/contracts` (`class XDto implements X`). Los nombres de eventos y tópicos se importan de ahí, nunca como strings sueltos.
- **Validación:** `ValidationPipe` global con `whitelist` y `forbidNonWhitelisted`, así que todo body/query necesita un DTO.
- **Latencia:** alertas críticas < 500 ms de punta a punta y REST de turnos < 50 ms (Cuadro 11.1). Nada bloqueante en el camino MQTT → WS.
- **Errores:** usá las excepciones HTTP de Nest (`NotFoundException`, etc.), con mensajes en español para el usuario final.
- **Tests:** jest (`pnpm nx test api`). Unit tests de services con mocks y del controller con `Test.createTestingModule`.
- **Swagger:** todo endpoint con `@ApiTags`, `@ApiOperation` y los decoradores de respuesta.

## Comandos

```bash
pnpm nx serve api     # http://localhost:3000/api  ·  Swagger: /api/docs
pnpm nx test api
pnpm nx build api
```
