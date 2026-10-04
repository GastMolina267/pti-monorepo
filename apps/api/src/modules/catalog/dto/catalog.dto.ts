import { ApiProperty } from '@nestjs/swagger';
import type { ConsultingRoom, ServiceArea } from '@vitalia/contracts';

export class ServiceAreaDto implements ServiceArea {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'CLINICA' }) code!: string;
  @ApiProperty({ example: 'Clínica Médica' }) name!: string;
  @ApiProperty({ example: 'A' }) prefix!: string;
}

export class ConsultingRoomDto implements ConsultingRoom {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'C4' }) code!: string;
  @ApiProperty({ example: 'Consultorio 4' }) name!: string;
  @ApiProperty({ required: false, nullable: true, type: String, example: 'Clínica Médica' }) specialty?:
    string | null;
}
