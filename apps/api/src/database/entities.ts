import { StaffUserEntity } from '../modules/auth/entities/staff-user.entity';
import { ConsultingRoomEntity } from '../modules/catalog/entities/consulting-room.entity';
import { ServiceAreaEntity } from '../modules/catalog/entities/service-area.entity';
import { AlertEntity } from '../modules/iomt/entities/alert.entity';
import { TelemetryReadingEntity } from '../modules/iomt/entities/telemetry-reading.entity';
import { WearableEntity } from '../modules/iomt/entities/wearable.entity';
import { PatientEntity } from '../modules/tickets/entities/patient.entity';
import { TicketEntity } from '../modules/tickets/entities/ticket.entity';

/**
 * Registro único de entidades. Se listan explícitamente (sin globs) para que
 * funcionen igual en el bundle de webpack, en el CLI de migraciones y en el seed.
 * Al crear una entidad nueva: agregarla acá y generar una migración.
 */
export const ENTITIES = [
  StaffUserEntity,
  ServiceAreaEntity,
  ConsultingRoomEntity,
  PatientEntity,
  TicketEntity,
  WearableEntity,
  TelemetryReadingEntity,
  AlertEntity,
];
