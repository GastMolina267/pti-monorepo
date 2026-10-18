import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertsModule } from '../alerts/alerts.module';
import { TelemetryReadingEntity } from '../iomt/entities/telemetry-reading.entity';
import { TicketsModule } from '../tickets/tickets.module';
import { WearablesModule } from '../wearables/wearables.module';
import { TelemetryService } from './telemetry.service';

/** Ingesta MQTT de los wearables (descifrado, validación, alertas, persistencia). */
@Module({
  imports: [TypeOrmModule.forFeature([TelemetryReadingEntity]), WearablesModule, AlertsModule, TicketsModule],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
