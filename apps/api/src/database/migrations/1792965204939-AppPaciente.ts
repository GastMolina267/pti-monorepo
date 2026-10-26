import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * App del paciente (Fase 5): nuevo origen de check-in `PATIENT_APP`.
 * `ADD VALUE` no se puede deshacer en PostgreSQL: el `down` recrea el enum sin el valor
 * (falla si quedaron turnos con ese origen, a propósito).
 */
export class AppPaciente1792965204939 implements MigrationInterface {
  name = 'AppPaciente1792965204939';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TYPE "public"."check_in_source" ADD VALUE IF NOT EXISTS 'PATIENT_APP'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TYPE "public"."check_in_source" RENAME TO "check_in_source_old"
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."check_in_source" AS ENUM('CAPTIVE_PORTAL', 'KIOSK', 'RECEPTION')
        `);
    await queryRunner.query(`
            ALTER TABLE "tickets" ALTER COLUMN "source" TYPE "public"."check_in_source" USING "source"::"text"::"public"."check_in_source"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."check_in_source_old"
        `);
  }
}
