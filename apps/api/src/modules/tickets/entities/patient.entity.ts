import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Datos mínimos del paciente (Ley 25.326). En desarrollo: solo datos simulados. */
@Entity({ name: 'patients' })
export class PatientEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 80 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 80 })
  lastName!: string;

  @Column({ name: 'document_number', type: 'varchar', length: 20, nullable: true, unique: true })
  documentNumber!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
