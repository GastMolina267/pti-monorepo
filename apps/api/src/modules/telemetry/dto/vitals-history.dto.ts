import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ALERT_KINDS,
  ALERT_STATUSES,
  TRIAGE_LEVELS,
  VITALS_HISTORY_DEFAULT_MINUTES,
  VITALS_HISTORY_MAX_MINUTES,
  type AlertKind,
  type AlertStatus,
  type TriageLevel,
  type VitalsHistory,
  type VitalsHistoryQuery,
  type VitalsPoint,
} from '@vitalia/contracts';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

class VitalsPointDto implements VitalsPoint {
  @ApiProperty() at!: string;
  @ApiProperty({ nullable: true, type: Number }) hr!: number | null;
  @ApiProperty({ nullable: true, type: Number }) spo2!: number | null;
  @ApiProperty({ nullable: true, type: Number }) temp!: number | null;
  @ApiProperty({ nullable: true, type: Number }) accPeakG!: number | null;
  @ApiProperty() fall!: boolean;
  @ApiProperty({ enum: TRIAGE_LEVELS }) level!: TriageLevel;
  @ApiProperty() samples!: number;
}

class VitalsAlertDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ALERT_KINDS }) kind!: AlertKind;
  @ApiProperty({ enum: ALERT_STATUSES }) status!: AlertStatus;
  @ApiProperty() detectedAt!: string;
}

export class VitalsHistoryDto implements VitalsHistory {
  @ApiProperty() ticketId!: string;
  @ApiProperty({ nullable: true, type: String }) wearableCode!: string | null;
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
  @ApiProperty() bucketSeconds!: number;
  @ApiProperty({ type: [VitalsPointDto] }) points!: VitalsPointDto[];
  @ApiProperty({ type: [VitalsAlertDto] }) alerts!: VitalsAlertDto[];
}

export class VitalsHistoryQueryDto implements VitalsHistoryQuery {
  @ApiPropertyOptional({ default: VITALS_HISTORY_DEFAULT_MINUTES, maximum: VITALS_HISTORY_MAX_MINUTES })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'minutes tiene que ser un número entero' })
  @Min(1, { message: 'minutes tiene que ser al menos 1' })
  @Max(VITALS_HISTORY_MAX_MINUTES, {
    message: `minutes no puede superar ${VITALS_HISTORY_MAX_MINUTES} (24 h)`,
  })
  minutes?: number;
}
