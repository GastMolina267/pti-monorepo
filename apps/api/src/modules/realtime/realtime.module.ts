import { Global, Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Tiempo real (Socket.IO). Global: los módulos de dominio inyectan `RealtimeGateway`
 * para emitir sin importar este módulo (y sin dependencias circulares).
 */
@Global()
@Module({
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
