import { Global, Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';

/** Conexión MQTT compartida (Mosquitto). Global, como `RealtimeModule`. */
@Global()
@Module({
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
