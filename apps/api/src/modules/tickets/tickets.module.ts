import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsultingRoomEntity } from '../catalog/entities/consulting-room.entity';
import { ServiceAreaEntity } from '../catalog/entities/service-area.entity';
import { PatientEntity } from './entities/patient.entity';
import { TicketEntity } from './entities/ticket.entity';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

/** Turnos y fila de espera. */
@Module({
  imports: [TypeOrmModule.forFeature([TicketEntity, PatientEntity, ServiceAreaEntity, ConsultingRoomEntity])],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
