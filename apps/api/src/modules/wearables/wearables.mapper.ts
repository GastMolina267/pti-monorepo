import {
  parseWearableCode,
  WEARABLE_ONLINE_WINDOW_MS,
  type Wearable,
  type WearableLastReading,
} from '@vitalia/contracts';
import type { TelemetryReadingEntity } from '../iomt/entities/telemetry-reading.entity';
import type { WearableEntity } from '../iomt/entities/wearable.entity';
import { displayName } from '../tickets/tickets.mapper';

const num = (v: string | null) => (v === null ? null : Number(v));

export function toLastReading(r: TelemetryReadingEntity): WearableLastReading {
  return {
    seq: r.seq,
    measuredAt: r.measuredAt.toISOString(),
    hr: r.heartRate,
    spo2: r.spo2,
    temp: num(r.temperature),
    accPeakG: num(r.accPeakG),
    fall: r.fall,
    level: r.triageLevel,
  };
}

/** Requiere la relación ticket.patient cargada. */
export function toWearable(
  w: WearableEntity,
  last: TelemetryReadingEntity | null,
  now = Date.now(),
): Wearable {
  return {
    id: w.id,
    code: w.code,
    number: parseWearableCode(w.code)?.number ?? 0,
    label: w.label,
    status: w.status,
    online: w.lastSeenAt !== null && now - w.lastSeenAt.getTime() <= WEARABLE_ONLINE_WINDOW_MS,
    room: w.lastRoom,
    ticket: w.ticket
      ? { id: w.ticket.id, code: w.ticket.code, patientDisplayName: displayName(w.ticket.patient) }
      : null,
    lastSeenAt: w.lastSeenAt?.toISOString() ?? null,
    lastReading: last ? toLastReading(last) : null,
  };
}
