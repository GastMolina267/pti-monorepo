import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CHECK_IN_SOURCES,
  TICKET_STATUSES,
  TRIAGE_LEVELS,
  type CallTicketRequest,
  type CheckInRequest,
  type CheckInSource,
  type PublicTicket,
  type Ticket,
  type TicketQuery,
  type TicketStatus,
  type TriageLevel,
  type UpdateTicketStatusRequest,
  type UpdateTriageRequest,
} from '@vitalia/contracts';
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import { ConsultingRoomDto, ServiceAreaDto } from '../../catalog/dto/catalog.dto';

class TicketPatientDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Lucía G.' }) displayName!: string;
}

export class TicketDto implements Ticket {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'A-024' }) code!: string;
  @ApiProperty({ enum: TICKET_STATUSES }) status!: TicketStatus;
  @ApiProperty({ enum: TRIAGE_LEVELS }) triageLevel!: TriageLevel;
  @ApiProperty({ enum: CHECK_IN_SOURCES }) source!: CheckInSource;
  @ApiPropertyOptional({ nullable: true, type: String }) reason?: string | null;
  @ApiProperty({ type: ServiceAreaDto }) service!: ServiceAreaDto;
  @ApiProperty({ type: TicketPatientDto }) patient!: TicketPatientDto;
  @ApiPropertyOptional({ type: ConsultingRoomDto, nullable: true }) consultingRoom?: ConsultingRoomDto | null;
  @ApiProperty() checkedInAt!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) calledAt?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) startedAt?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) finishedAt?: string | null;
}

export class PublicTicketDto implements PublicTicket {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'A-024' }) code!: string;
  @ApiProperty({ enum: TICKET_STATUSES }) status!: TicketStatus;
  @ApiProperty({ example: 'Clínica Médica' }) serviceName!: string;
  @ApiPropertyOptional({ nullable: true, type: String, example: 'Consultorio 4' }) consultingRoomName?:
    string | null;
  @ApiProperty({ nullable: true, type: Number, example: 3 }) position!: number | null;
  @ApiProperty({ nullable: true, type: Number, example: 36 }) estimatedWaitMinutes!: number | null;
  @ApiProperty() checkedInAt!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) calledAt?: string | null;
}

export class CheckInDto implements CheckInRequest {
  @ApiProperty({ example: 'Lucía' })
  @IsString({ message: 'El nombre es obligatorio' })
  @Length(2, 80, { message: 'El nombre debe tener entre 2 y 80 caracteres' })
  firstName!: string;

  @ApiProperty({ example: 'Gómez' })
  @IsString({ message: 'El apellido es obligatorio' })
  @Length(2, 80, { message: 'El apellido debe tener entre 2 y 80 caracteres' })
  lastName!: string;

  @ApiPropertyOptional({ example: '30123456', description: 'DNI sin puntos (dato personal, opcional)' })
  @IsOptional()
  @Matches(/^\d{7,9}$/, { message: 'El DNI debe tener entre 7 y 9 dígitos, sin puntos' })
  documentNumber?: string;

  @ApiProperty({ example: 'CLINICA' })
  @IsString({ message: 'Elegí un servicio' })
  @IsNotEmpty({ message: 'Elegí un servicio' })
  serviceCode!: string;

  @ApiProperty({ enum: CHECK_IN_SOURCES, example: 'CAPTIVE_PORTAL' })
  @IsIn(CHECK_IN_SOURCES, { message: `El origen debe ser uno de: ${CHECK_IN_SOURCES.join(', ')}` })
  source!: CheckInSource;

  @ApiPropertyOptional({ example: 'Dolor de cabeza desde ayer' })
  @IsOptional()
  @IsString()
  @MaxLength(280, { message: 'El motivo puede tener hasta 280 caracteres' })
  reason?: string;
}

export class TicketQueryDto implements TicketQuery {
  @ApiPropertyOptional({
    description: 'Estados separados por coma (por defecto, los abiertos)',
    example: 'WAITING,CALLED',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'CLINICA' })
  @IsOptional()
  @IsString()
  serviceCode?: string;
}

export class CallTicketDto implements CallTicketRequest {
  @ApiProperty()
  @IsUUID('4', { message: 'Elegí un consultorio válido' })
  consultingRoomId!: string;
}

export class UpdateTicketStatusDto implements UpdateTicketStatusRequest {
  @ApiProperty({ enum: TICKET_STATUSES })
  @IsIn(TICKET_STATUSES, { message: `El estado debe ser uno de: ${TICKET_STATUSES.join(', ')}` })
  status!: TicketStatus;
}

export class UpdateTriageDto implements UpdateTriageRequest {
  @ApiProperty({ enum: TRIAGE_LEVELS })
  @IsIn(TRIAGE_LEVELS, { message: `El nivel de triaje debe ser uno de: ${TRIAGE_LEVELS.join(', ')}` })
  triageLevel!: TriageLevel;
}
