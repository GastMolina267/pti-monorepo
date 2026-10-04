import { toDayKey } from './day-key';

describe('toDayKey', () => {
  it('usa la hora de Argentina (UTC-3) y no la de UTC', () => {
    // 02:30 UTC del 4/10 son las 23:30 del 3/10 en Córdoba
    expect(toDayKey(new Date('2026-10-04T02:30:00Z'))).toBe('2026-10-03');
    expect(toDayKey(new Date('2026-10-04T03:30:00Z'))).toBe('2026-10-04');
  });
});
