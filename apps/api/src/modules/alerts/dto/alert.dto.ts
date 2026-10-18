import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ALERT_KINDS,
  ALERT_STATUSES,
  TRIAGE_LEVELS,
  type Alert,
  type AlertKind,
  type AlertQuery,
  type AlertStatus,
  type TriageLevel,
} from '@vitalia/contracts';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

class AlertStaffDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Lic. Paula Romero' }) fullName!: string;
}

export class AlertDto implements Alert {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ALERT_KINDS }) kind!: AlertKind;
  @ApiProperty({ enum: TRIAGE_LEVELS }) level!: TriageLevel;
  @ApiProperty({ enum: ALERT_STATUSES }) status!: AlertStatus;
  @ApiProperty({ example: 'Caída detectada' }) message!: string;
  @ApiProperty({ example: 'wb-07-24d7cc' }) wearableId!: string;
  @ApiProperty({ nullable: true, type: String }) ticketId!: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'A-024' }) ticketCode!: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'Lucía G.' }) patientDisplayName!: string | null;
  @ApiProperty() detectedAt!: string;
  @ApiProperty({ nullable: true, type: String }) acknowledgedAt!: string | null;
  @ApiProperty({ nullable: true, type: AlertStaffDto }) acknowledgedBy!: AlertStaffDto | null;
}

export class AlertQueryDto implements AlertQuery {
  @ApiPropertyOptional({ default: true, description: 'false: las últimas 100 de cualquier estado' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean({ message: 'active debe ser true o false' })
  active?: boolean;
}
