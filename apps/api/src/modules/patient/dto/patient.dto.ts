import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PAIRING_CODE_LENGTH,
  TRIAGE_LEVELS,
  type CheckInResponse,
  type PairingCode,
  type PairRequest,
  type PatientOverview,
  type PatientSession,
  type PatientTicket,
  type PatientVitals,
  type TriageLevel,
} from '@vitalia/contracts';
import { IsString, Length } from 'class-validator';
import { PublicTicketDto } from '../../tickets/dto/ticket.dto';

export class PatientSessionDto implements PatientSession {
  @ApiProperty({ description: 'Bearer para /api/patient/*' }) token!: string;
  @ApiProperty() expiresAt!: string;
  @ApiProperty() ticketId!: string;
}

export class CheckInResponseDto extends PublicTicketDto implements CheckInResponse {
  @ApiPropertyOptional({
    type: PatientSessionDto,
    description: 'Solo con source PATIENT_APP y si el turno se creó en este pedido',
  })
  patientSession?: PatientSessionDto;
}

export class PairingCodeDto implements PairingCode {
  @ApiProperty({ example: 'K7M2QX' }) code!: string;
  @ApiProperty() expiresAt!: string;
  @ApiProperty({ example: 'A-024' }) ticketCode!: string;
}

export class PairDto implements PairRequest {
  @ApiProperty({ example: 'K7M2QX' })
  @IsString({ message: 'Escribí el código que te dio el personal' })
  @Length(PAIRING_CODE_LENGTH, PAIRING_CODE_LENGTH + 4, {
    message: `El código tiene ${PAIRING_CODE_LENGTH} caracteres`,
  })
  code!: string;
}

class PatientTicketDto extends PublicTicketDto implements PatientTicket {
  @ApiProperty({ example: 'CLINICA' }) serviceCode!: string;
  @ApiProperty({ enum: TRIAGE_LEVELS }) triageLevel!: TriageLevel;
  @ApiProperty({ nullable: true, type: String }) reason!: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'Dra. Laura Fernández' }) professionalName!:
    string | null;
  @ApiProperty({ nullable: true, type: String }) startedAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) finishedAt!: string | null;
}

class PatientVitalsDto implements PatientVitals {
  @ApiProperty({ example: 'wb-03-5e0003' }) wearableCode!: string;
  @ApiProperty() measuredAt!: string;
  @ApiProperty({ nullable: true, type: Number }) hr!: number | null;
  @ApiProperty({ nullable: true, type: Number }) spo2!: number | null;
  @ApiProperty({ nullable: true, type: Number }) temp!: number | null;
  @ApiProperty() fall!: boolean;
  @ApiProperty({ enum: TRIAGE_LEVELS }) level!: TriageLevel;
  @ApiProperty({ type: [String] }) reasons!: string[];
}

class PatientNameDto {
  @ApiProperty({ example: 'Lucía' }) firstName!: string;
  @ApiProperty({ example: 'Lucía G.' }) displayName!: string;
}

export class PatientOverviewDto implements PatientOverview {
  @ApiProperty({ type: PatientNameDto }) patient!: PatientNameDto;
  @ApiProperty({ type: PatientTicketDto }) ticket!: PatientTicketDto;
  @ApiProperty({ nullable: true, type: PatientVitalsDto }) vitals!: PatientVitalsDto | null;
  @ApiProperty() serverTime!: string;
}
