import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 2 (ingesta IoMT):
 * - `telemetry_readings.seq` pasa a bigint: `arranque × 2^24 + contador` supera int32 desde
 *   el arranque 128 (y el simulador usa como arranque los segundos desde 2024).
 *   Se usa ALTER TYPE (no DROP/ADD como generó TypeORM) para no perder lecturas.
 * - Índice único `(wearable_id, seq)`: respaldo en la base de la deduplicación de QoS 1.
 * - `wearables.last_room`: sala del tópico, para publicar comandos en `.../cmd`.
 * - Índice de alertas por wearable y estado (no duplicar alertas activas).
 */
export class Fase2Iomt1792349670937 implements MigrationInterface {
  name = 'Fase2Iomt1792349670937';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "wearables"
            ADD "last_room" character varying(40)
        `);
    await queryRunner.query(`
            ALTER TABLE "telemetry_readings" ALTER COLUMN "seq" TYPE bigint
        `);
    await queryRunner.query(`
            CREATE INDEX "ix_alerts_wearable_status" ON "alerts" ("wearable_id", "status")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_readings_wearable_seq" ON "telemetry_readings" ("wearable_id", "seq")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX "public"."uq_readings_wearable_seq"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."ix_alerts_wearable_status"
        `);
    // Falla si hay lecturas con seq > 2^31-1: revertir solo en bases de desarrollo.
    await queryRunner.query(`
            ALTER TABLE "telemetry_readings" ALTER COLUMN "seq" TYPE integer
        `);
    await queryRunner.query(`
            ALTER TABLE "wearables" DROP COLUMN "last_room"
        `);
  }
}
