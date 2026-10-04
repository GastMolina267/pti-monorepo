import type { PublicTicket, Ticket } from '@vitalia/contracts';
import { toConsultingRoom, toServiceArea } from '../catalog/catalog.mapper';
import type { PatientEntity } from './entities/patient.entity';
import type { TicketEntity } from './entities/ticket.entity';

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** "Lucía Gómez" → "Lucía G." (minimiza datos personales en pantallas). */
export function displayName(p: Pick<PatientEntity, 'firstName' | 'lastName'>): string {
  const initial = p.lastName.trim().charAt(0).toUpperCase();
  return initial ? `${p.firstName.trim()} ${initial}.` : p.firstName.trim();
}

/** Requiere las relaciones service, patient y consultingRoom cargadas. */
export function toTicket(t: TicketEntity): Ticket {
  return {
    id: t.id,
    code: t.code,
    status: t.status,
    triageLevel: t.triageLevel,
    source: t.source,
    reason: t.reason,
    service: toServiceArea(t.service),
    patient: { id: t.patient.id, displayName: displayName(t.patient) },
    consultingRoom: t.consultingRoom ? toConsultingRoom(t.consultingRoom) : null,
    checkedInAt: t.checkedInAt.toISOString(),
    calledAt: iso(t.calledAt),
    startedAt: iso(t.startedAt),
    finishedAt: iso(t.finishedAt),
  };
}

export function toPublicTicket(t: TicketEntity, position: number | null, avgMinutes: number): PublicTicket {
  return {
    id: t.id,
    code: t.code,
    status: t.status,
    serviceName: t.service.name,
    consultingRoomName: t.consultingRoom?.name ?? null,
    position,
    estimatedWaitMinutes: position === null ? null : position * avgMinutes,
    checkedInAt: t.checkedInAt.toISOString(),
    calledAt: iso(t.calledAt),
  };
}
