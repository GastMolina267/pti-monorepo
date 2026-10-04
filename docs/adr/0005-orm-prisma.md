# 0005. Prisma como ORM

- Estado: **Propuesto** (se decide al iniciar la Fase 1)
- Fecha: 2026-10-03

## Contexto

La API necesita persistir en PostgreSQL 16 (RF-O6), con migraciones, seeds de > 10.000 registros simulados y tipos fuertes que la IA pueda seguir sin errores.

## Propuesta

**Prisma** (`schema.prisma` declarativo, cliente tipado, `prisma migrate`), integrado en un módulo `database` de la API.

## Alternativas

- **TypeORM:** el clásico de Nest con decoradores. Más verboso y con tipado más débil en las queries.
- **Drizzle:** liviano y SQL-first. Menos ejemplos con Nest.
- **MikroORM:** unit of work. Más complejo para el alcance.

## Consecuencias si se acepta

- (+) Esquema legible (sirve para la tesis), migraciones reproducibles y DX muy buena con IA.
- (−) Un paso de generación del cliente (`prisma generate`) que hay que agregar al build y la CI.
