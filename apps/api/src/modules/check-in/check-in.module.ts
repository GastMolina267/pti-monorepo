import { Module } from '@nestjs/common';
import { PatientModule } from '../patient/patient.module';
import { TicketsModule } from '../tickets/tickets.module';
import { CheckInController } from './check-in.controller';

@Module({
  imports: [TicketsModule, PatientModule],
  controllers: [CheckInController],
})
export class CheckInModule {}
