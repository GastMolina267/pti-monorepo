import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TRIAGE_LEVELS,
  WEARABLE_CODE_PATTERN,
  WEARABLE_STATUSES,
  type AssignWearableRequest,
  type CreateWearableRequest,
  type TriageLevel,
  type Wearable,
  type WearableLastReading,
  type WearableStatus,
} from '@vitalia/contracts';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

class WearableTicketDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'A-024' }) code!: string;
  @ApiProperty({ example: 'Lucía G.' }) patientDisplayName!: string;
}

class WearableLastReadingDto implements WearableLastReading {
  @ApiProperty() seq!: number;
  @ApiProperty() measuredAt!: string;
  @ApiProperty({ nullable: true, type: Number, example: 78 }) hr!: number | null;
  @ApiProperty({ nullable: true, type: Number, example: 98 }) spo2!: number | null;
  @ApiProperty({ nullable: true, type: Number, example: 36.6 }) temp!: number | null;
  @ApiProperty({ nullable: true, type: Number, example: 1.02 }) accPeakG!: number | null;
  @ApiProperty() fall!: boolean;
  @ApiProperty({ enum: TRIAGE_LEVELS }) level!: TriageLevel;
}

export class WearableDto implements Wearable {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'wb-07-24d7cc' }) code!: string;
  @ApiProperty({ example: 7 }) number!: number;
  @ApiProperty({ nullable: true, type: String, example: 'Pulsera 7' }) label!: string | null;
  @ApiProperty({ enum: WEARABLE_STATUSES }) status!: WearableStatus;
  @ApiProperty({ description: 'Publicó en los últimos 30 s' }) online!: boolean;
  @ApiProperty({ nullable: true, type: String, example: 'sala1' }) room!: string | null;
  @ApiProperty({ nullable: true, type: WearableTicketDto }) ticket!: WearableTicketDto | null;
  @ApiProperty({ nullable: true, type: String }) lastSeenAt!: string | null;
  @ApiProperty({ nullable: true, type: WearableLastReadingDto }) lastReading!: WearableLastReadingDto | null;
}

export class CreateWearableDto implements CreateWearableRequest {
  @ApiProperty({ example: 'wb-09-a1b2c3', description: 'wb-<número 01–99>-<últimos 3 bytes de la MAC>' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString({ message: 'El código es obligatorio' })
  @Matches(WEARABLE_CODE_PATTERN, {
    message: 'El código tiene que ser wb-<NN>-<mac>, con NN de 01 a 99 y 6 hex de la MAC (ej. wb-07-24d7cc)',
  })
  code!: string;

  @ApiPropertyOptional({ example: 'Pulsera 9' })
  @IsOptional()
  @IsString({ message: 'La etiqueta tiene que ser texto' })
  @Length(1, 80, { message: 'La etiqueta debe tener entre 1 y 80 caracteres' })
  label?: string;
}

export class AssignWearableDto implements AssignWearableRequest {
  @ApiProperty()
  @IsUUID('4', { message: 'El turno no es válido' })
  ticketId!: string;
}
