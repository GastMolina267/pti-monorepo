import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import {
  CHECK_IN_SOURCES,
  TICKET_STATUSES,
  TRIAGE_LEVELS,
  type CheckInSource,
  type TicketStatus,
  type TriageLevel,
} from '@vitalia/contracts';
import { StaffUserEntity } from '../../auth/entities/staff-user.entity';
import { ConsultingRoomEntity } from '../../catalog/entities/consulting-room.entity';
import { ServiceAreaEntity } from '../../catalog/entities/service-area.entity';
import { PatientEntity } from './patient.entity';

@Entity({ name: 'tickets' })
@Unique('uq_tickets_service_day_number', ['serviceId', 'dayKey', 'number'])
@Index('ix_tickets_queue', ['status', 'triageLevel', 'checkedInAt'])
export class TicketEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Código visible (ej. A-024). */
  @Column({ type: 'varchar', length: 12 })
  code!: string;

  @Column({ type: 'int' })
  number!: number;

  /** Día operativo en hora de Argentina (YYYY-MM-DD): la numeración reinicia cada día. */
  @Index('ix_tickets_day_key')
  @Column({ name: 'day_key', type: 'varchar', length: 10 })
  dayKey!: string;

  @Column({ type: 'enum', enum: TICKET_STATUSES, enumName: 'ticket_status', default: 'WAITING' })
  status!: TicketStatus;

  @Column({
    name: 'triage_level',
    type: 'enum',
    enum: TRIAGE_LEVELS,
    enumName: 'triage_level',
    default: 'STABLE',
  })
  triageLevel!: TriageLevel;

  @Column({ type: 'enum', enum: CHECK_IN_SOURCES, enumName: 'check_in_source' })
  source!: CheckInSource;

  @Column({ type: 'varchar', length: 280, nullable: true })
  reason!: string | null;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId!: string;

  @ManyToOne(() => ServiceAreaEntity, { nullable: false })
  @JoinColumn({ name: 'service_id' })
  service!: ServiceAreaEntity;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @ManyToOne(() => PatientEntity, { nullable: false })
  @JoinColumn({ name: 'patient_id' })
  patient!: PatientEntity;

  @Column({ name: 'consulting_room_id', type: 'uuid', nullable: true })
  consultingRoomId!: string | null;

  @ManyToOne(() => ConsultingRoomEntity, { nullable: true })
  @JoinColumn({ name: 'consulting_room_id' })
  consultingRoom!: ConsultingRoomEntity | null;

  @Column({ name: 'called_by_id', type: 'uuid', nullable: true })
  calledById!: string | null;

  @ManyToOne(() => StaffUserEntity, { nullable: true })
  @JoinColumn({ name: 'called_by_id' })
  calledBy!: StaffUserEntity | null;

  @Column({ name: 'checked_in_at', type: 'timestamptz', default: () => 'now()' })
  checkedInAt!: Date;

  @Column({ name: 'called_at', type: 'timestamptz', nullable: true })
  calledAt!: Date | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
