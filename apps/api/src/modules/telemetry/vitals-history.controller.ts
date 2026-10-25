import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VitalsHistoryDto, VitalsHistoryQueryDto } from './dto/vitals-history.dto';
import { VitalsHistoryService } from './vitals-history.service';

const uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class VitalsHistoryController {
  constructor(private readonly history: VitalsHistoryService) {}

  @Get(':id/readings')
  @ApiOperation({ summary: 'Curva de signos vitales del turno (agrupada si la ventana es larga)' })
  @ApiOkResponse({ type: VitalsHistoryDto })
  @ApiNotFoundResponse({ description: 'Turno no encontrado' })
  readings(@Param('id', uuid) id: string, @Query() query: VitalsHistoryQueryDto): Promise<VitalsHistoryDto> {
    return this.history.forTicket(id, query.minutes);
  }
}
