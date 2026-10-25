import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertsModule } from '../alerts/alerts.module';
import { TelemetryReadingEntity } from '../iomt/entities/telemetry-reading.entity';
import { TicketsModule } from '../tickets/tickets.module';
import { WearablesModule } from '../wearables/wearables.module';
import { TelemetryRetentionService } from './telemetry-retention.service';
import { TelemetryService } from './telemetry.service';
import { VitalsHistoryController } from './vitals-history.controller';
import { VitalsHistoryService } from './vitals-history.service';

/** Ingesta MQTT de los wearables (descifrado, validación, alertas, persistencia). */
@Module({
  imports: [TypeOrmModule.forFeature([TelemetryReadingEntity]), WearablesModule, AlertsModule, TicketsModule],
  controllers: [VitalsHistoryController],
  providers: [TelemetryService, TelemetryRetentionService, VitalsHistoryService],
  exports: [TelemetryService, VitalsHistoryService],
})
export class TelemetryModule {}
