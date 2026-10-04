import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ConsultingRoomEntity } from './entities/consulting-room.entity';
import { ServiceAreaEntity } from './entities/service-area.entity';

/** Catálogo: servicios de atención y consultorios. */
@Module({
  imports: [TypeOrmModule.forFeature([ServiceAreaEntity, ConsultingRoomEntity])],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
