import type { ConsultingRoom, ServiceArea } from '@vitalia/contracts';
import type { ConsultingRoomEntity } from './entities/consulting-room.entity';
import type { ServiceAreaEntity } from './entities/service-area.entity';

export const toServiceArea = (s: ServiceAreaEntity): ServiceArea => ({
  id: s.id,
  code: s.code,
  name: s.name,
  prefix: s.prefix,
});

export const toConsultingRoom = (r: ConsultingRoomEntity): ConsultingRoom => ({
  id: r.id,
  code: r.code,
  name: r.name,
  specialty: r.specialty,
});
