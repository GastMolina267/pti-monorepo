# 0009. Usar TypeORM como ORM

- Estado: Aceptado
- Fecha: 2026-10-04
- Autores: Equipo PTI
- Reemplaza a: [0005](0005-orm-prisma.md)

## Contexto

La Fase 1 necesita persistencia en PostgreSQL 16 con migraciones versionadas y seeds, y que cualquier entorno (Windows, CI, Docker en el gateway, sesiones de IA en la nube) pueda **generar y aplicar migraciones sin descargar binarios externos**.

## Decisión

**TypeORM 1.1** (`typeorm` + `@nestjs/typeorm` 11 + driver `pg`):

- **Entidades por dominio:** `apps/api/src/modules/<dominio>/entities/*.entity.ts`.
  - Columnas en `snake_case` con `name` explícito.
  - **Tipo explícito en cada columna**, para que el CLI funcione con `tsx` (esbuild no emite metadata de decoradores).
- **Registro único sin globs:**
  - Entidades: `src/database/entities.ts`.
  - Migraciones: `src/database/migrations/index.ts`.
  - Así funcionan dentro del bundle de webpack, en el CLI y en el seed.
- **Migraciones generadas** por diff contra la base (`pnpm db:generate --name=<Cambio>`), revisadas a mano y versionadas en git. `synchronize: false` siempre.
- **UUIDs** con `gen_random_uuid()` (nativo de PostgreSQL 13+): no hace falta ninguna extensión ni superusuario.
- **Seed** determinístico e idempotente (`pnpm db:seed`), con datos simulados.

## Alternativas consideradas

- **Prisma 7:** bloqueado por la descarga del `schema-engine` ([ADR 0005](0005-orm-prisma.md)).
- **Drizzle:** TS puro y SQL-first, con menos integración y menos ejemplos con NestJS.

## Consecuencias

- (+) Integración nativa con NestJS (`TypeOrmModule`, `@InjectRepository`). Sin binarios ni pasos de codegen.
- (+) Las migraciones SQL son legibles y sirven como anexo de la tesis.
- (−) Tipado de consultas más débil que Prisma: se compensa con DTOs y mappers tipados contra `@vitalia/contracts`.
- (−) TypeORM duplica el `CREATE TYPE` cuando varias entidades comparten un enum (ej. `triage_level`). Hay que revisar cada migración generada (documentado en la skill `vitalia-database`).
