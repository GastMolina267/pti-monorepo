import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ROLES_CAN_MANAGE_WEARABLES } from '@vitalia/contracts';
import { Roles } from '../../common/auth/roles.decorator';
import { AssignWearableDto, CreateWearableDto, WearableDto } from './dto/wearable.dto';
import { WearablesService } from './wearables.service';

const uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('wearables')
@ApiBearerAuth()
@Controller('wearables')
export class WearablesController {
  constructor(private readonly wearables: WearablesService) {}

  @Get()
  @ApiOperation({ summary: 'Pulseras con su turno, conexión y última lectura' })
  @ApiOkResponse({ type: [WearableDto] })
  list(): Promise<WearableDto[]> {
    return this.wearables.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una pulsera' })
  @ApiOkResponse({ type: WearableDto })
  @ApiNotFoundResponse({ description: 'Pulsera no encontrada' })
  findOne(@Param('id', uuid) id: string): Promise<WearableDto> {
    return this.wearables.findOne(id);
  }

  @Roles(...ROLES_CAN_MANAGE_WEARABLES)
  @Post()
  @ApiOperation({ summary: 'Dar de alta una pulsera (código wb-<NN>-<mac>, número sin repetir)' })
  @ApiCreatedResponse({ type: WearableDto })
  @ApiConflictResponse({ description: 'Ya existe una pulsera con ese código o ese número' })
  create(@Body() dto: CreateWearableDto): Promise<WearableDto> {
    return this.wearables.create(dto);
  }

  @Post(':id/assign')
  @HttpCode(200)
  @ApiOperation({ summary: 'Asignar la pulsera a un turno abierto' })
  @ApiOkResponse({ type: WearableDto })
  @ApiConflictResponse({
    description: 'Pulsera ocupada o en mantenimiento, turno cerrado o con otra pulsera',
  })
  assign(@Param('id', uuid) id: string, @Body() dto: AssignWearableDto): Promise<WearableDto> {
    return this.wearables.assign(id, dto.ticketId);
  }

  @Post(':id/release')
  @HttpCode(200)
  @ApiOperation({ summary: 'Liberar la pulsera (vuelve a quedar disponible)' })
  @ApiOkResponse({ type: WearableDto })
  release(@Param('id', uuid) id: string): Promise<WearableDto> {
    return this.wearables.release(id);
  }
}
