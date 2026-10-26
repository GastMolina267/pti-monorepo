import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelemetryReadingEntity } from '../iomt/entities/telemetry-reading.entity';
import { WearableEntity } from '../iomt/entities/wearable.entity';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { TicketsModule } from '../tickets/tickets.module';
import { PairingService } from './pairing.service';
import { PairingController, PatientController } from './patient.controller';
import { PatientGuard } from './patient.guard';
import { PatientSessionService } from './patient-session.service';
import { PatientService } from './patient.service';

/** App del paciente: sesión de turno, vinculación por código y su vista del turno (ADR 0019). */
@Module({
  imports: [
    TypeOrmModule.forFeature([TelemetryReadingEntity, WearableEntity]),
    TicketsModule,
    TelemetryModule,
  ],
  controllers: [PatientController, PairingController],
  providers: [PatientSessionService, PairingService, PatientService, PatientGuard],
  exports: [PatientSessionService],
})
export class PatientModule {}
