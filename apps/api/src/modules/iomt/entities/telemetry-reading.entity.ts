import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  type ValueTransformer,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TRIAGE_LEVELS, type TriageLevel } from '@vitalia/contracts';
import { TicketEntity } from '../../tickets/entities/ticket.entity';
import { WearableEntity } from './wearable.entity';

/**
 * `seq` llega a ~2^53 (`arranque × 2^24 + contador`): va en `bigint`. pg lo devuelve como
 * string; acá se convierte a number, que es exacto hasta `Number.MAX_SAFE_INTEGER`.
 */
const bigintNumber: ValueTransformer = {
  to: (v: number | null | undefined) => v,
  from: (v: string | null) => (v === null ? null : Number(v)),
};

/** Lectura biométrica descifrada. */
@Entity({ name: 'telemetry_readings' })
@Index('uq_readings_wearable_seq', ['wearableId', 'seq'], { unique: true })
@Index('ix_readings_wearable_time', ['wearableId', 'measuredAt'])
@Index('ix_readings_ticket_time', ['ticketId', 'measuredAt'])
@Index('ix_readings_measured_at', ['measuredAt'])
export class TelemetryReadingEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'wearable_id', type: 'uuid' })
  wearableId!: string;

  @ManyToOne(() => WearableEntity, { nullable: false })
  @JoinColumn({ name: 'wearable_id' })
  wearable!: WearableEntity;

  @Column({ name: 'ticket_id', type: 'uuid', nullable: true })
  ticketId!: string | null;

  @ManyToOne(() => TicketEntity, { nullable: true })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: TicketEntity | null;

  /** Contador monotónico del firmware (deduplicación QoS 1, índice único con el wearable). */
  @Column({ type: 'bigint', transformer: bigintNumber })
  seq!: number;

  @Column({ name: 'measured_at', type: 'timestamptz' })
  measuredAt!: Date;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt!: Date;

  @Column({ name: 'heart_rate', type: 'smallint', nullable: true })
  heartRate!: number | null;

  @Column({ type: 'smallint', nullable: true })
  spo2!: number | null;

  @Column({ type: 'numeric', precision: 4, scale: 1, nullable: true })
  temperature!: string | null;

  @Column({ name: 'acc_peak_g', type: 'numeric', precision: 5, scale: 2, nullable: true })
  accPeakG!: string | null;

  @Column({ type: 'boolean', default: false })
  fall!: boolean;

  @Column({ name: 'triage_level', type: 'enum', enum: TRIAGE_LEVELS, enumName: 'triage_level' })
  triageLevel!: TriageLevel;
}
