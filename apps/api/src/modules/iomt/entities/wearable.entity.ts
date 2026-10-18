import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { WEARABLE_STATUSES, type WearableStatus } from '@vitalia/contracts';
import { TicketEntity } from '../../tickets/entities/ticket.entity';

/** Pulsera IoMT. */
@Entity({ name: 'wearables' })
export class WearableEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Identificador publicado por el firmware en el tópico MQTT: `wb-<NN>-<mac>` (ej. wb-07-24d7cc, ADR 0011). */
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

  /** `<sala>` del tópico de la última lectura: a dónde se publican los comandos (`.../cmd`). */
  @Column({ name: 'last_room', type: 'varchar', length: 40, nullable: true })
  lastRoom!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
