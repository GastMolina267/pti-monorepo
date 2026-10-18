import type { TicketCalledEvent } from '@vitalia/contracts';
import { spokenCall } from '../../core/sound/announcer.service';
import { applyCall, EMPTY_BOARD, fromRecent } from './call-board';

const call = (n: number, room = `Consultorio ${n}`): TicketCalledEvent => ({
  ticketId: `t${n}`,
  ticketCode: `A-${String(n).padStart(3, '0')}`,
  consultingRoom: room,
  calledAt: new Date(Date.UTC(2026, 9, 18, 12, n)).toISOString(),
});

describe('applyCall', () => {
  it('el llamado nuevo pasa arriba y el anterior va al historial', () => {
    const b = applyCall(applyCall(EMPTY_BOARD, call(1)), call(2));
    expect(b.current?.ticketCode).toBe('A-002');
    expect(b.history.map((h) => h.ticketCode)).toEqual(['A-001']);
  });

  it('un re-llamado no se duplica en el historial', () => {
    let b = [call(1), call(2), call(3)].reduce(applyCall, EMPTY_BOARD);
    b = applyCall(b, { ...call(2), consultingRoom: 'Consultorio 9' });
    expect(b.current).toMatchObject({ ticketCode: 'A-002', consultingRoom: 'Consultorio 9' });
    expect(b.history.map((h) => h.ticketCode)).toEqual(['A-003', 'A-001']);
    // volver a llamar al que ya está arriba no lo mueve al historial
    expect(applyCall(b, call(2)).history.map((h) => h.ticketCode)).toEqual(['A-003', 'A-001']);
  });

  it('guarda como máximo 5 en el historial', () => {
    const b = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => call(n)).reduce(applyCall, EMPTY_BOARD);
    expect(b.history).toHaveLength(5);
    expect(b.history[0].ticketCode).toBe('A-007');
  });
});

describe('fromRecent', () => {
  it('el primero de GET /recent-calls es el actual', () => {
    expect(fromRecent([call(3), call(2), call(1)])).toMatchObject({
      current: { ticketCode: 'A-003' },
      history: [{ ticketCode: 'A-002' }, { ticketCode: 'A-001' }],
    });
    expect(fromRecent([])).toEqual(EMPTY_BOARD);
  });
});

describe('spokenCall', () => {
  it('lee el número sin los ceros', () => {
    expect(spokenCall({ ticketCode: 'A-024', consultingRoom: 'Consultorio 4' })).toBe(
      'Turno A 24. Consultorio 4.',
    );
    expect(spokenCall({ ticketCode: 'RARO', consultingRoom: 'Box 1' })).toBe('Turno RARO. Box 1.');
  });
});
