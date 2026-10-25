import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncOutboxEntity } from './entities/sync-outbox.entity';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

/** Réplica a la nube por outbox (RF-O6). Global: tickets y alertas encolan sin importar el módulo. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SyncOutboxEntity])],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
