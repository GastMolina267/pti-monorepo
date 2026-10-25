import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 5 (operación de largo plazo):
 * - `sync_outbox`: cambios de turnos y alertas pendientes de replicar a la nube (RF-O6).
 * - `ix_readings_measured_at`: la limpieza de telemetría vieja borra por fecha sin recorrer
 *   la tabla entera (~1,4 M de lecturas por día con 50 pulseras).
 */
export class Fase5Operacion1792939333032 implements MigrationInterface {
  name = 'Fase5Operacion1792939333032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TYPE "public"."sync_topic" AS ENUM('ticket.upsert', 'alert.upsert')
        `);
    await queryRunner.query(`
            CREATE TABLE "sync_outbox" (
                "id" BIGSERIAL NOT NULL,
                "topic" "public"."sync_topic" NOT NULL,
                "entity_id" uuid NOT NULL,
                "payload" jsonb NOT NULL,
                "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "sent_at" TIMESTAMP WITH TIME ZONE,
                "attempts" integer NOT NULL DEFAULT '0',
                CONSTRAINT "PK_68c2c881108310bbe2d6cd3ed43" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "ix_sync_outbox_pending" ON "sync_outbox" ("sent_at", "id")
        `);
    await queryRunner.query(`
            CREATE INDEX "ix_readings_measured_at" ON "telemetry_readings" ("measured_at")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX "public"."ix_readings_measured_at"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."ix_sync_outbox_pending"
        `);
    await queryRunner.query(`
            DROP TABLE "sync_outbox"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."sync_topic"
        `);
  }
}
