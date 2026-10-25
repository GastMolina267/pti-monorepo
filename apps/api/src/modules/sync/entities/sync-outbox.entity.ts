import { SYNC_TOPICS, type SyncTopic } from '@vitalia/contracts';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Outbox local para la réplica a la nube (RF-O6). Se borra lo enviado hace más de 7 días. */
@Entity({ name: 'sync_outbox' })
@Index('ix_sync_outbox_pending', ['sentAt', 'id'])
export class SyncOutboxEntity {
  /** bigint: pg lo devuelve como string (se convierte a number al armar el lote). */
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'enum', enum: SYNC_TOPICS, enumName: 'sync_topic' })
  topic!: SyncTopic;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId!: string;

  @Column({ type: 'jsonb' })
  payload!: unknown;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  attempts!: number;
}
