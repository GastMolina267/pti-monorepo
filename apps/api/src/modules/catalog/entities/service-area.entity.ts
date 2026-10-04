import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Servicio de atención: define el prefijo del código de turno (A, B, C…). */
@Entity({ name: 'service_areas' })
export class ServiceAreaEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 40, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 2, unique: true })
  prefix!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}
