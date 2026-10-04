---
name: vitalia-database
description: Trabajar con la base de datos de la API Vitalia (PostgreSQL 16 + TypeORM 1.1) - crear o modificar entidades, generar y revisar migraciones, actualizar el seed, escribir consultas con repositorios o QueryBuilder, transacciones e índices. Usala ante cualquier cambio de esquema, nueva tabla o columna, consulta compleja o problema con migraciones.
---

# Base de datos (PostgreSQL 16 + TypeORM)

Decisión y motivos: `docs/adr/0009-orm-typeorm.md`. Modelo actual: `docs/08-modelo-datos.md`.

## Dónde está cada cosa

| Qué | Ruta |
| --- | --- |
| Entidades | `apps/api/src/modules/<dominio>/entities/<nombre>.entity.ts` |
| **Registro de entidades** | `apps/api/src/database/entities.ts` (array `ENTITIES`, sin globs) |
| Migraciones | `apps/api/src/database/migrations/<timestamp>-<Nombre>.ts` |
| **Registro de migraciones** | `apps/api/src/database/migrations/index.ts` (array `MIGRATIONS`, en orden) |
| Opciones compartidas | `apps/api/src/database/options.ts` |
| CLI (DataSource) | `apps/api/src/database/data-source.ts` |
| Seed | `apps/api/src/database/seeds/seed.ts` |

## Flujo para cambiar el esquema

1. Si el cambio toca un contrato (enum, campo expuesto), empezá por `@vitalia/contracts` (skill `vitalia-contracts`).
2. Creá o editá la entidad siguiendo las reglas de abajo. Si es nueva, **agregala a `ENTITIES`**.
3. Con la base local migrada (`pnpm infra:up && pnpm db:migrate`), generá la migración por diff:
   ```bash
   pnpm db:generate --name=AddWearableBattery
   ```
4. **Revisá el SQL generado.** Ojo con:
   - Enums compartidos entre entidades (ej. `triage_level`): TypeORM duplica el `CREATE TYPE` y el `DROP TYPE`. Dejá una sola ocurrencia (ver `1791077335265-InitialSchema.ts`).
   - Renombres: TypeORM los ve como DROP + ADD (se pierden datos). Reescribí con `RENAME COLUMN`.
   - Columnas `NOT NULL` nuevas en tablas con datos: necesitan `DEFAULT` o un backfill.
5. **Registrala** al final de `MIGRATIONS` en `migrations/index.ts`.
6. Probá ida y vuelta: `pnpm db:migrate && pnpm db:revert && pnpm db:migrate`.
7. Verificá que no quede diferencia: `pnpm db:generate --name=Check` tiene que responder *"No changes in database schema were found"*.
8. Actualizá el seed si corresponde y `docs/08-modelo-datos.md` (diagrama ER y tablas).

## Reglas para entidades

```ts
@Entity({ name: 'wearables' })                       // tabla snake_case en plural
export class WearableEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;       // gen_random_uuid() (sin extensiones)

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })  // name snake_case + type SIEMPRE explícito
  lastSeenAt!: Date | null;

  @Column({ type: 'enum', enum: WEARABLE_STATUSES, enumName: 'wearable_status', default: 'AVAILABLE' })
  status!: WearableStatus;                           // enumName fijo = tipo de PostgreSQL compartible

  @Column({ name: 'ticket_id', type: 'uuid', nullable: true })   // FK como columna explícita…
  ticketId!: string | null;
  @OneToOne(() => TicketEntity) @JoinColumn({ name: 'ticket_id' })  // …y la relación
  ticket!: TicketEntity | null;
}
```

- **`type` explícito en toda columna.** El CLI corre con `tsx` (esbuild), que no emite `design:type`: sin `type`, la migración sale mal o falla.
- Fechas: `timestamptz`. Dinero o medidas con decimales: `numeric` con `precision` y `scale` (TypeORM lo devuelve como `string`). IDs de alto volumen: `bigint` autoincremental.
- Enums con los valores de `@vitalia/contracts` (`enum: TICKET_STATUSES`).
- Datos sensibles (`password_hash`): `select: false`. Para leerlos, `addSelect` explícito.
- Índices con nombre (`@Index('ix_<tabla>_<campos>', [...])`) pensados para las consultas reales.
- Nunca `synchronize: true`.

## Consultas

- Repositorios en services: `@InjectRepository(XEntity) private readonly xs: Repository<XEntity>` (registrar con `TypeOrmModule.forFeature([...])` en el módulo).
- **Updates parciales con `repo.update(id, { campo })`.** Con `save()` sobre una entidad que tiene la relación cargada, la relación pisa a la columna FK (ej. setear `consultingRoomId = null` no tiene efecto si `consultingRoom` sigue cargado).
- Operaciones de varios pasos dentro de una transacción: `this.dataSource.transaction(async (m) => { ... })`, usando **solo** `m`.
- Concurrencia con unicidad (numeración de turnos): constraint `UNIQUE` + reintento ante el código `23505` (ver `TicketsService.checkIn`).
- Mapeá entidad → contrato en un `*.mapper.ts`. Nunca devuelvas entidades desde un controller.

## Seed

- Idempotente: `upsert` por clave natural (`code`, `email`). Los datos transaccionales solo se crean si no existen para el día.
- **Determinístico y sin dependencias solo-ESM** (Jest corre en CommonJS): usa su propio generador (`rng`).
- Solo datos simulados. Se niega a correr con `NODE_ENV=production`.

## Tests

- Unitarios: mock de `Repository`/`DataSource` con `jest.fn()`.
- Integración: `apps/api/src/app.int.spec.ts` recrea el esquema en `TEST_DATABASE_URL` (migraciones + seed) y prueba por HTTP. Si agregás un flujo de datos importante, sumalo ahí.
