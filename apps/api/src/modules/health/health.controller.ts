import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './health.dto';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Estado del Edge Gateway y sus dependencias' })
  @ApiOkResponse({ type: HealthResponseDto })
  get(): HealthResponseDto {
    return this.health.check();
  }
}
