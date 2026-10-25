import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/auth/roles.decorator';
import { SyncStatusDto } from './sync.dto';
import { SyncService } from './sync.service';

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Roles('ADMIN')
  @Get('status')
  @ApiOperation({ summary: 'Estado de la réplica a la nube (pendientes, último envío, errores)' })
  @ApiOkResponse({ type: SyncStatusDto })
  status(): Promise<SyncStatusDto> {
    return this.sync.status();
  }
}
