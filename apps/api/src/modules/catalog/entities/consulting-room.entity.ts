import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'consulting_rooms' })
export class ConsultingRoomEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  specialty!: string | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}
