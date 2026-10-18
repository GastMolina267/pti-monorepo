import type { TelemetryReadingEvent, Wearable } from '@vitalia/contracts';
import { applyReading, assessLastReading } from './wearables.store';

const W: Wearable = {
  id: 'w1',
  code: 'wb-03-5e0003',
  number: 3,
  label: null,
  status: 'ASSIGNED',
  online: false,
  room: 'sala1',
  ticket: { id: 't1', code: 'B-003', patientDisplayName: 'Agustina A.' },
  lastSeenAt: null,
  lastReading: null,
};

const event = (
  seq: number,
  patch: Partial<TelemetryReadingEvent['reading']> = {},
): TelemetryReadingEvent => ({
  wearableId: W.code,
  ticketId: 't1',
  ticketCode: 'B-003',
  reading: { wearableId: W.code, seq, ts: Date.UTC(2026, 9, 18, 20), hr: 80, spo2: 97, temp: 36.6, ...patch },
  assessment: { level: patch.fall ? 'CRITICAL' : 'STABLE', reasons: patch.fall ? ['Caída detectada'] : [] },
  receivedAt: '2026-10-18T20:00:00.010Z',
});

describe('applyReading', () => {
  it('actualiza la última lectura y la hora de la pulsera', () => {
    const [w] = applyReading([W], event(10, { fall: true }));
    expect(w.lastSeenAt).toBe('2026-10-18T20:00:00.010Z');
    expect(w.lastReading).toMatchObject({ seq: 10, hr: 80, fall: true, level: 'CRITICAL', accPeakG: null });
  });

  it('ignora una lectura más vieja que la que ya tiene y otras pulseras', () => {
    const updated = applyReading([W], event(10));
    expect(applyReading(updated, event(9, { hr: 200 }))[0].lastReading?.hr).toBe(80);
    expect(applyReading([W], { ...event(11), wearableId: 'wb-04-5e0004' })[0]).toBe(W);
  });
});

describe('assessLastReading', () => {
  it('usa la misma regla que la API', () => {
    expect(assessLastReading(null)).toBeNull();
    expect(
      assessLastReading({
        seq: 1,
        measuredAt: '',
        hr: 80,
        spo2: 85,
        temp: null,
        accPeakG: null,
        fall: false,
        level: 'CRITICAL',
      }),
    ).toEqual({ level: 'CRITICAL', reasons: ['Hipoxia (SpO₂ 85%)'] });
  });
});
