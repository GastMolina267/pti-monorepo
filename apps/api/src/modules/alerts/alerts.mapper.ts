import type { Alert } from '@vitalia/contracts';
import type { AlertEntity } from '../iomt/entities/alert.entity';
import { displayName } from '../tickets/tickets.mapper';

/** Requiere las relaciones wearable, ticket.patient y acknowledgedBy cargadas. */
export function toAlert(a: AlertEntity): Alert {
  return {
    id: a.id,
    kind: a.kind,
    level: a.level,
    status: a.status,
    message: a.message,
    wearableId: a.wearable.code,
    ticketId: a.ticketId,
    ticketCode: a.ticket?.code ?? null,
    patientDisplayName: a.ticket?.patient ? displayName(a.ticket.patient) : null,
    detectedAt: a.detectedAt.toISOString(),
    acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
    acknowledgedBy: a.acknowledgedBy
      ? { id: a.acknowledgedBy.id, fullName: a.acknowledgedBy.fullName }
      : null,
  };
}
