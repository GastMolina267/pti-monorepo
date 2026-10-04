import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TicketEntity } from '../../tickets/entities/ticket.entity';

export const WEARABLE_STATUSES = ['AVAILABLE', 'ASSIGNED', 'OFFLINE', 'MAINTENANCE'] as const;
export type WearableStatus = (typeof WEARABLE_STATUSES)[number];

/** Pulsera IoMT (se usa desde la Fase 2). */
@Entity({ name: 'wearables' })
export class WearableEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Identificador publicado por el firmware en el tópico MQTT (ej. w-07). */
  @Column({ type: 'varchar', length: 40, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  label!: string | null;

  @Column({ type: 'enum', enum: WEARABLE_STATUSES, enumName: 'wearable_status', default: 'AVAILABLE' })
  status!: WearableStatus;

  /** Turno al que está asignada la pulsera (una a la vez). */
  @Column({ name: 'ticket_id', type: 'uuid', nullable: true, unique: true })
  ticketId!: string | null;

  @OneToOne(() => TicketEntity, { nullable: true })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: TicketEntity | null;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
