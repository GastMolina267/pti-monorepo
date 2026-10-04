import { Module } from '@nestjs/common';
import { TicketsModule } from '../tickets/tickets.module';
import { CheckInController } from './check-in.controller';

@Module({
  imports: [TicketsModule],
  controllers: [CheckInController],
})
export class CheckInModule {}
