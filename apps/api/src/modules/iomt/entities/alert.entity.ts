import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TRIAGE_LEVELS, type AlertEmergencyEvent, type TriageLevel } from '@vitalia/contracts';
import { StaffUserEntity } from '../../auth/entities/staff-user.entity';
import { TicketEntity } from '../../tickets/entities/ticket.entity';
import { WearableEntity } from './wearable.entity';

export const ALERT_KINDS = ['FALL', 'HYPOXIA', 'TACHYCARDIA', 'BRADYCARDIA', 'FEVER', 'HYPOTHERMIA'] as const;
export const ALERT_STATUSES = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

/** Alerta clínica (se usa desde la Fase 2). */
@Entity({ name: 'alerts' })
@Index('ix_alerts_status_time', ['status', 'detectedAt'])
export class AlertEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ALERT_KINDS, enumName: 'alert_kind' })
  kind!: AlertEmergencyEvent['kind'];

  @Column({ type: 'enum', enum: TRIAGE_LEVELS, enumName: 'triage_level' })
  level!: TriageLevel;

  @Column({ type: 'enum', enum: ALERT_STATUSES, enumName: 'alert_status', default: 'ACTIVE' })
  status!: AlertStatus;

  @Column({ type: 'varchar', length: 200 })
  message!: string;

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

  @Column({ name: 'detected_at', type: 'timestamptz' })
  detectedAt!: Date;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt!: Date | null;

  @Column({ name: 'acknowledged_by_id', type: 'uuid', nullable: true })
  acknowledgedById!: string | null;

  @ManyToOne(() => StaffUserEntity, { nullable: true })
  @JoinColumn({ name: 'acknowledged_by_id' })
  acknowledgedBy!: StaffUserEntity | null;
}
