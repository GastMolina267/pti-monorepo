import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertEntity } from '../iomt/entities/alert.entity';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

/** Alertas clínicas: se abren desde la telemetría y las reconoce el personal. */
@Module({
  imports: [TypeOrmModule.forFeature([AlertEntity])],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
