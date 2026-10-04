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
import { CheckInDto, PublicTicketDto } from '../tickets/dto/ticket.dto';
import { TicketsService } from '../tickets/tickets.service';

/**
 * Check-in público (RF-O5): lo usan el portal cautivo (VLAN 20) y el kiosk (VLAN 40).
 * Con límite de pedidos por IP para evitar abuso desde la red abierta de pacientes.
 */
@ApiTags('check-in')
@Controller('check-in')
export class CheckInController {
  constructor(private readonly tickets: TicketsService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @ApiOperation({ summary: 'Registrar llegada y obtener un turno' })
  @ApiCreatedResponse({ type: PublicTicketDto })
  @ApiNotFoundResponse({ description: 'Servicio inexistente' })
  @ApiTooManyRequestsResponse({ description: 'Demasiados intentos, esperá un minuto' })
  checkIn(@Body() dto: CheckInDto): Promise<PublicTicketDto> {
    return this.tickets.checkIn(dto);
  }
}
