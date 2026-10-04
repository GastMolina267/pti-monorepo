import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ROLES_CAN_CALL, ROLES_CAN_TRIAGE } from '@vitalia/contracts';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import {
  CallTicketDto,
  PublicTicketDto,
  TicketDto,
  TicketQueryDto,
  UpdateTicketStatusDto,
  UpdateTriageDto,
} from './dto/ticket.dto';
import { TicketsService } from './tickets.service';

const uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Fila del día (por defecto, turnos abiertos), ordenada por triaje y llegada' })
  @ApiOkResponse({ type: [TicketDto] })
  list(@Query() query: TicketQueryDto): Promise<TicketDto[]> {
    return this.tickets.list(query);
  }

  @Public()
  @Get(':id/public')
  @ApiOperation({ summary: 'Estado del turno para el paciente (portal / app): posición y espera estimada' })
  @ApiOkResponse({ type: PublicTicketDto })
  @ApiNotFoundResponse({ description: 'Turno no encontrado' })
  getPublic(@Param('id', uuid) id: string): Promise<PublicTicketDto> {
    return this.tickets.getPublic(id);
  }

  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un turno' })
  @ApiOkResponse({ type: TicketDto })
  findOne(@Param('id', uuid) id: string): Promise<TicketDto> {
    return this.tickets.findOne(id);
  }

  @ApiBearerAuth()
  @Roles(...ROLES_CAN_CALL)
  @Post(':id/call')
  @ApiOperation({ summary: 'Llamar el turno a un consultorio (o volver a llamarlo)' })
  @ApiOkResponse({ type: TicketDto })
  @ApiConflictResponse({ description: 'El estado actual no permite llamarlo' })
  call(
    @Param('id', uuid) id: string,
    @Body() dto: CallTicketDto,
    @CurrentUser() user: AuthUser,
  ): Promise<TicketDto> {
    return this.tickets.call(id, dto.consultingRoomId, user);
  }

  @ApiBearerAuth()
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Cambiar el estado (en atención, finalizado, ausente, cancelado, volver a la fila)',
  })
  @ApiOkResponse({ type: TicketDto })
  @ApiConflictResponse({ description: 'Transición de estado inválida' })
  updateStatus(@Param('id', uuid) id: string, @Body() dto: UpdateTicketStatusDto): Promise<TicketDto> {
    return this.tickets.updateStatus(id, dto.status);
  }

  @ApiBearerAuth()
  @Roles(...ROLES_CAN_TRIAGE)
  @Patch(':id/triage')
  @ApiOperation({ summary: 'Triaje manual (Estable / Atención / Crítico)' })
  @ApiOkResponse({ type: TicketDto })
  updateTriage(@Param('id', uuid) id: string, @Body() dto: UpdateTriageDto): Promise<TicketDto> {
    return this.tickets.updateTriage(id, dto.triageLevel);
  }
}
