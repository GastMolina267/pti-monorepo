import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Esquema inicial (Fase 1). Nota: TypeORM duplica el CREATE/DROP TYPE de enums
 * compartidos (triage_level): se dejó una sola ocurrencia a mano.
 */
export class InitialSchema1791077335265 implements MigrationInterface {
  name = 'InitialSchema1791077335265';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TYPE "public"."staff_role" AS ENUM('ADMIN', 'NURSE', 'DOCTOR', 'RECEPTION')
        `);
    await queryRunner.query(`
            CREATE TABLE "staff_users" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "email" character varying(160) NOT NULL,
                "full_name" character varying(120) NOT NULL,
                "password_hash" character varying(100) NOT NULL,
                "role" "public"."staff_role" NOT NULL,
                "active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_4f32dd66546226ea64f5573b770" UNIQUE ("email"),
                CONSTRAINT "PK_c6b167335377df69f7910c2c75e" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "consulting_rooms" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "code" character varying(20) NOT NULL,
                "name" character varying(80) NOT NULL,
                "specialty" character varying(80),
                "active" boolean NOT NULL DEFAULT true,
                CONSTRAINT "UQ_ada2d6b6763a0c6c3b1af940774" UNIQUE ("code"),
                CONSTRAINT "PK_847797ba4210a8d1b2b92114bfe" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "service_areas" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "code" character varying(40) NOT NULL,
                "name" character varying(80) NOT NULL,
                "prefix" character varying(2) NOT NULL,
                "active" boolean NOT NULL DEFAULT true,
                CONSTRAINT "UQ_60f5db26dcc94201fc27f83a138" UNIQUE ("code"),
                CONSTRAINT "UQ_15af29607229d8e4ef5a6a8b838" UNIQUE ("prefix"),
                CONSTRAINT "PK_cdda4e5b616d5be3c81d15fd756" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "patients" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "first_name" character varying(80) NOT NULL,
                "last_name" character varying(80) NOT NULL,
                "document_number" character varying(20),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_85bcb7ae36549e3eb85686078d0" UNIQUE ("document_number"),
                CONSTRAINT "PK_a7f0b9fcbb3469d5ec0b0aceaa7" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."ticket_status" AS ENUM(
                'WAITING',
                'CALLED',
                'IN_PROGRESS',
                'DONE',
                'NO_SHOW',
                'CANCELLED'
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."triage_level" AS ENUM('STABLE', 'ATTENTION', 'CRITICAL')
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."check_in_source" AS ENUM('CAPTIVE_PORTAL', 'KIOSK', 'RECEPTION')
        `);
    await queryRunner.query(`
            CREATE TABLE "tickets" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "code" character varying(12) NOT NULL,
                "number" integer NOT NULL,
                "day_key" character varying(10) NOT NULL,
                "status" "public"."ticket_status" NOT NULL DEFAULT 'WAITING',
                "triage_level" "public"."triage_level" NOT NULL DEFAULT 'STABLE',
                "source" "public"."check_in_source" NOT NULL,
                "reason" character varying(280),
                "service_id" uuid NOT NULL,
                "patient_id" uuid NOT NULL,
                "consulting_room_id" uuid,
                "called_by_id" uuid,
                "checked_in_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "called_at" TIMESTAMP WITH TIME ZONE,
                "started_at" TIMESTAMP WITH TIME ZONE,
                "finished_at" TIMESTAMP WITH TIME ZONE,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "uq_tickets_service_day_number" UNIQUE ("service_id", "day_key", "number"),
                CONSTRAINT "PK_343bc942ae261cf7a1377f48fd0" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "ix_tickets_day_key" ON "tickets" ("day_key")
        `);
    await queryRunner.query(`
            CREATE INDEX "ix_tickets_queue" ON "tickets" ("status", "triage_level", "checked_in_at")
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."wearable_status" AS ENUM(
                'AVAILABLE',
                'ASSIGNED',
                'OFFLINE',
                'MAINTENANCE'
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "wearables" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "code" character varying(40) NOT NULL,
                "label" character varying(80),
                "status" "public"."wearable_status" NOT NULL DEFAULT 'AVAILABLE',
                "ticket_id" uuid,
                "last_seen_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_f060cc8e41004da7e8c0e94ed9d" UNIQUE ("code"),
                CONSTRAINT "UQ_cc98d6dd1ce945a73b9d82dba58" UNIQUE ("ticket_id"),
                CONSTRAINT "REL_cc98d6dd1ce945a73b9d82dba5" UNIQUE ("ticket_id"),
                CONSTRAINT "PK_a232e333947a5ee352608d8f330" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."alert_kind" AS ENUM(
                'FALL',
                'HYPOXIA',
                'TACHYCARDIA',
                'BRADYCARDIA',
                'FEVER',
                'HYPOTHERMIA'
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."alert_status" AS ENUM('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')
        `);
    await queryRunner.query(`
            CREATE TABLE "alerts" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "kind" "public"."alert_kind" NOT NULL,
                "level" "public"."triage_level" NOT NULL,
                "status" "public"."alert_status" NOT NULL DEFAULT 'ACTIVE',
                "message" character varying(200) NOT NULL,
                "wearable_id" uuid NOT NULL,
                "ticket_id" uuid,
                "detected_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "acknowledged_at" TIMESTAMP WITH TIME ZONE,
                "acknowledged_by_id" uuid,
                CONSTRAINT "PK_60f895662df096bfcdfab7f4b96" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "ix_alerts_status_time" ON "alerts" ("status", "detected_at")
        `);
    await queryRunner.query(`
            CREATE TABLE "telemetry_readings" (
                "id" BIGSERIAL NOT NULL,
                "wearable_id" uuid NOT NULL,
                "ticket_id" uuid,
                "seq" integer NOT NULL,
                "measured_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "heart_rate" smallint,
                "spo2" smallint,
                "temperature" numeric(4, 1),
                "acc_peak_g" numeric(5, 2),
                "fall" boolean NOT NULL DEFAULT false,
                "triage_level" "public"."triage_level" NOT NULL,
                CONSTRAINT "PK_3c576a1d50104b70a55fb0025ad" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "ix_readings_ticket_time" ON "telemetry_readings" ("ticket_id", "measured_at")
        `);
    await queryRunner.query(`
            CREATE INDEX "ix_readings_wearable_time" ON "telemetry_readings" ("wearable_id", "measured_at")
        `);
    await queryRunner.query(`
            ALTER TABLE "tickets"
            ADD CONSTRAINT "FK_e460ec1588e906d63ce17f514d8" FOREIGN KEY ("service_id") REFERENCES "service_areas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "tickets"
            ADD CONSTRAINT "FK_ae8aba72bf3b385551e6c779315" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "tickets"
            ADD CONSTRAINT "FK_f00feedf192a353c51e2783b1e5" FOREIGN KEY ("consulting_room_id") REFERENCES "consulting_rooms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "tickets"
            ADD CONSTRAINT "FK_df395bede51e1b51d32873d95d4" FOREIGN KEY ("called_by_id") REFERENCES "staff_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "wearables"
            ADD CONSTRAINT "FK_cc98d6dd1ce945a73b9d82dba58" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "alerts"
            ADD CONSTRAINT "FK_e880887be91c791e6f28123cc6c" FOREIGN KEY ("wearable_id") REFERENCES "wearables"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "alerts"
            ADD CONSTRAINT "FK_b834eb2a5e2d3247f4ccf4679cc" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "alerts"
            ADD CONSTRAINT "FK_00f213b9af2a7f181a831e85182" FOREIGN KEY ("acknowledged_by_id") REFERENCES "staff_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "telemetry_readings"
            ADD CONSTRAINT "FK_740e1d38c794c42b3e012930b4f" FOREIGN KEY ("wearable_id") REFERENCES "wearables"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "telemetry_readings"
            ADD CONSTRAINT "FK_86cde5662a4b8c1b4aed4431e27" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "telemetry_readings" DROP CONSTRAINT "FK_86cde5662a4b8c1b4aed4431e27"
        `);
    await queryRunner.query(`
            ALTER TABLE "telemetry_readings" DROP CONSTRAINT "FK_740e1d38c794c42b3e012930b4f"
        `);
    await queryRunner.query(`
            ALTER TABLE "alerts" DROP CONSTRAINT "FK_00f213b9af2a7f181a831e85182"
        `);
    await queryRunner.query(`
            ALTER TABLE "alerts" DROP CONSTRAINT "FK_b834eb2a5e2d3247f4ccf4679cc"
        `);
    await queryRunner.query(`
            ALTER TABLE "alerts" DROP CONSTRAINT "FK_e880887be91c791e6f28123cc6c"
        `);
    await queryRunner.query(`
            ALTER TABLE "wearables" DROP CONSTRAINT "FK_cc98d6dd1ce945a73b9d82dba58"
        `);
    await queryRunner.query(`
            ALTER TABLE "tickets" DROP CONSTRAINT "FK_df395bede51e1b51d32873d95d4"
        `);
    await queryRunner.query(`
            ALTER TABLE "tickets" DROP CONSTRAINT "FK_f00feedf192a353c51e2783b1e5"
        `);
    await queryRunner.query(`
            ALTER TABLE "tickets" DROP CONSTRAINT "FK_ae8aba72bf3b385551e6c779315"
        `);
    await queryRunner.query(`
            ALTER TABLE "tickets" DROP CONSTRAINT "FK_e460ec1588e906d63ce17f514d8"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."ix_readings_wearable_time"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."ix_readings_ticket_time"
        `);
    await queryRunner.query(`
            DROP TABLE "telemetry_readings"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."ix_alerts_status_time"
        `);
    await queryRunner.query(`
            DROP TABLE "alerts"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."alert_status"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."alert_kind"
        `);
    await queryRunner.query(`
            DROP TABLE "wearables"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."wearable_status"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."ix_tickets_queue"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."ix_tickets_day_key"
        `);
    await queryRunner.query(`
            DROP TABLE "tickets"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."check_in_source"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."triage_level"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."ticket_status"
        `);
    await queryRunner.query(`
            DROP TABLE "patients"
        `);
    await queryRunner.query(`
            DROP TABLE "service_areas"
        `);
    await queryRunner.query(`
            DROP TABLE "consulting_rooms"
        `);
    await queryRunner.query(`
            DROP TABLE "staff_users"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."staff_role"
        `);
  }
}
