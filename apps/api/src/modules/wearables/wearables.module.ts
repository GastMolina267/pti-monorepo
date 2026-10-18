import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelemetryReadingEntity } from '../iomt/entities/telemetry-reading.entity';
import { WearableEntity } from '../iomt/entities/wearable.entity';
import { TicketEntity } from '../tickets/entities/ticket.entity';
import { WearablesController } from './wearables.controller';
import { WearablesService } from './wearables.service';

/** Pulseras IoMT: alta, asignación a turnos y comandos al OLED (`.../cmd`). */
@Module({
  imports: [TypeOrmModule.forFeature([WearableEntity, TelemetryReadingEntity, TicketEntity])],
  controllers: [WearablesController],
  providers: [WearablesService],
  exports: [WearablesService],
})
export class WearablesModule {}
