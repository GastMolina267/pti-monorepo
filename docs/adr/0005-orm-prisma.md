# 0005. Prisma como ORM

- Estado: **Rechazado** — reemplazado por [0009](0009-orm-typeorm.md)
- Fecha: 2026-10-03 (propuesto) · 2026-10-04 (rechazado)

## Contexto

La API necesita persistir en PostgreSQL 16 (RF-O6), con migraciones y seeds, y tipos fuertes que la IA pueda seguir sin errores.

## Propuesta original

**Prisma** (`schema.prisma` declarativo, cliente tipado, `prisma migrate`), integrado en un módulo `database` de la API.

## Por qué se rechazó

Al iniciar la Fase 1 (Prisma 7.10):

- Las migraciones necesitan un binario nativo (`schema-engine`) que se descarga desde `binaries.prisma.sh`. Esa descarga está bloqueada en entornos con red restringida (sesiones de IA en la nube, la VM de desarrollo), así que esos entornos no pueden migrar la base.
- La etiqueta `latest` de npm apuntaba a una versión 8 RC con un modelo nuevo ("contract-first"), y la documentación oficial ya describía ese modelo. Eso agregaba inestabilidad.

El equipo eligió TypeORM ([ADR 0009](0009-orm-typeorm.md)).
