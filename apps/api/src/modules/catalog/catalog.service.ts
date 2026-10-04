import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ConsultingRoom, ServiceArea } from '@vitalia/contracts';
import { Repository } from 'typeorm';
import { toConsultingRoom, toServiceArea } from './catalog.mapper';
import { ConsultingRoomEntity } from './entities/consulting-room.entity';
import { ServiceAreaEntity } from './entities/service-area.entity';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(ServiceAreaEntity) private readonly services: Repository<ServiceAreaEntity>,
    @InjectRepository(ConsultingRoomEntity) private readonly rooms: Repository<ConsultingRoomEntity>,
  ) {}

  async listServices(): Promise<ServiceArea[]> {
    const rows = await this.services.find({ where: { active: true }, order: { prefix: 'ASC' } });
    return rows.map(toServiceArea);
  }

  async listRooms(): Promise<ConsultingRoom[]> {
    const rows = await this.rooms.find({ where: { active: true }, order: { code: 'ASC' } });
    return rows.map(toConsultingRoom);
  }
}
