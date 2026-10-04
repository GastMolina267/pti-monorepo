import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { STAFF_ROLES, type StaffRole } from '@vitalia/contracts';

@Entity({ name: 'staff_users' })
export class StaffUserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 160, unique: true })
  email!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 120 })
  fullName!: string;

  /** Hash bcrypt. Nunca se expone en respuestas. */
  @Column({ name: 'password_hash', type: 'varchar', length: 100, select: false })
  passwordHash!: string;

  @Column({ type: 'enum', enum: STAFF_ROLES, enumName: 'staff_role' })
  role!: StaffRole;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
