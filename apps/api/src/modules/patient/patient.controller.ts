import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/auth/public.decorator';
import { VitalsHistoryDto, VitalsHistoryQueryDto } from '../telemetry/dto/vitals-history.dto';
import { VitalsHistoryService } from '../telemetry/vitals-history.service';
import { PairDto, PairingCodeDto, PatientOverviewDto, PatientSessionDto } from './dto/patient.dto';
import { CurrentPatient, PatientGuard } from './patient.guard';
import type { PatientPrincipal } from './patient-session.service';
import { PatientService } from './patient.service';

const uuid = new ParseUUIDPipe({ version: '4' });

/**
 * App del paciente (ADR 0019). Son `@Public()` para el guard del personal: la sesión del
 * paciente la valida {@link PatientGuard}.
 */
@ApiTags('patient')
@Controller('patient')
export class PatientController {
  constructor(
    private readonly patients: PatientService,
    private readonly history: VitalsHistoryService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('pair')
  @HttpCode(200)
  @ApiOperation({ summary: 'Vincular la app con el código que generó el personal' })
  @ApiOkResponse({ type: PatientSessionDto })
  @ApiUnauthorizedResponse({ description: 'Código inválido, ya usado o vencido' })
  @ApiTooManyRequestsResponse({ description: 'Demasiados intentos, esperá un minuto' })
  pair(@Body() dto: PairDto): Promise<PatientSessionDto> {
    return this.patients.pair(dto.code);
  }

  @Public()
  @UseGuards(PatientGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Mi turno: estado, a dónde y con quién, y mis últimos signos vitales' })
  @ApiOkResponse({ type: PatientOverviewDto })
  me(@CurrentPatient() patient: PatientPrincipal): Promise<PatientOverviewDto> {
    return this.patients.overview(patient);
  }

  @Public()
  @UseGuards(PatientGuard)
  @ApiBearerAuth()
  @Get('me/readings')
  @ApiOperation({ summary: 'Mi curva de signos vitales durante la espera' })
  @ApiOkResponse({ type: VitalsHistoryDto })
  readings(
    @CurrentPatient() patient: PatientPrincipal,
    @Query() query: VitalsHistoryQueryDto,
  ): Promise<VitalsHistoryDto> {
    return this.history.forTicket(patient.ticketId, query.minutes);
  }
}

/** El personal genera el código de vinculación de un turno (Backoffice). */
@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class PairingController {
  constructor(private readonly patients: PatientService) {}

  @Post(':id/pairing')
  @ApiOperation({ summary: 'Código de un solo uso (10 min) para vincular la app del paciente' })
  @ApiCreatedResponse({ type: PairingCodeDto })
  createPairing(@Param('id', uuid) id: string): Promise<PairingCodeDto> {
    return this.patients.createPairing(id);
  }
}
