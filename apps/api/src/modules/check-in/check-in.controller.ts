import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/auth/public.decorator';
import { CheckInResponseDto } from '../patient/dto/patient.dto';
import { PatientSessionService } from '../patient/patient-session.service';
import { CheckInDto } from '../tickets/dto/ticket.dto';
import { TicketsService } from '../tickets/tickets.service';

/**
 * Check-in público (RF-O5): lo usan el portal cautivo (VLAN 20), el kiosk (VLAN 40) y la app
 * del paciente (`source: PATIENT_APP`, que además recibe su sesión de turno; ADR 0019).
 * Con límite de pedidos por IP para evitar abuso desde la red abierta de pacientes.
 */
@ApiTags('check-in')
@Controller('check-in')
export class CheckInController {
  constructor(
    private readonly tickets: TicketsService,
    private readonly sessions: PatientSessionService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @ApiOperation({ summary: 'Registrar llegada y obtener un turno' })
  @ApiCreatedResponse({ type: CheckInResponseDto })
  @ApiNotFoundResponse({ description: 'Servicio inexistente' })
  @ApiTooManyRequestsResponse({ description: 'Demasiados intentos, esperá un minuto' })
  async checkIn(@Body() dto: CheckInDto): Promise<CheckInResponseDto> {
    const { ticket, patientId, created } = await this.tickets.checkInDetailed(dto);
    if (dto.source !== 'PATIENT_APP' || !created) return ticket;
    return { ...ticket, patientSession: await this.sessions.issue(ticket.id, patientId) };
  }
}
