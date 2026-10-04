import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/public.decorator';
import { CatalogService } from './catalog.service';
import { ConsultingRoomDto, ServiceAreaDto } from './dto/catalog.dto';

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get('services')
  @ApiOperation({ summary: 'Servicios de atención activos (para el check-in del portal o kiosk)' })
  @ApiOkResponse({ type: [ServiceAreaDto] })
  services(): Promise<ServiceAreaDto[]> {
    return this.catalog.listServices();
  }

  @ApiBearerAuth()
  @Get('consulting-rooms')
  @ApiOperation({ summary: 'Consultorios activos' })
  @ApiOkResponse({ type: [ConsultingRoomDto] })
  rooms(): Promise<ConsultingRoomDto[]> {
    return this.catalog.listRooms();
  }
}
