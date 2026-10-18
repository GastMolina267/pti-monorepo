import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AlertsService } from './alerts.service';
import { AlertDto, AlertQueryDto } from './dto/alert.dto';

const uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('alerts')
@ApiBearerAuth()
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Alertas clínicas (por defecto, solo las activas), la más reciente primero' })
  @ApiOkResponse({ type: [AlertDto] })
  list(@Query() query: AlertQueryDto): Promise<AlertDto[]> {
    return this.alerts.list(query.active ?? true);
  }

  @Post(':id/ack')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reconocer una alerta (emite alert:acknowledged al personal)' })
  @ApiOkResponse({ type: AlertDto })
  @ApiNotFoundResponse({ description: 'Alerta no encontrada' })
  @ApiConflictResponse({ description: 'La alerta ya fue reconocida' })
  acknowledge(@Param('id', uuid) id: string, @CurrentUser() user: AuthUser): Promise<AlertDto> {
    return this.alerts.acknowledge(id, user);
  }
}
