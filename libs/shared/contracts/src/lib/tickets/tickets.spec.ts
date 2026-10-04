import { canTransition, compareQueueOrder, formatTicketCode } from './tickets';

describe('formatTicketCode', () => {
  it('completa con ceros a 3 dígitos', () => {
    expect(formatTicketCode('A', 24)).toBe('A-024');
    expect(formatTicketCode('B', 1234)).toBe('B-1234');
  });
});

describe('canTransition', () => {
  it('permite el flujo normal de atención', () => {
    expect(canTransition('WAITING', 'CALLED')).toBe(true);
    expect(canTransition('CALLED', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'DONE')).toBe(true);
  });

  it('permite volver a llamar y devolver a la fila', () => {
    expect(canTransition('CALLED', 'CALLED')).toBe(true);
    expect(canTransition('CALLED', 'WAITING')).toBe(true);
  });

  it('rechaza saltos inválidos y estados finales', () => {
    expect(canTransition('WAITING', 'DONE')).toBe(false);
    expect(canTransition('DONE', 'WAITING')).toBe(false);
    expect(canTransition('CANCELLED', 'CALLED')).toBe(false);
  });
});

describe('compareQueueOrder', () => {
  const t = (triageLevel: 'STABLE' | 'ATTENTION' | 'CRITICAL', checkedInAt: string) => ({
    triageLevel,
    checkedInAt,
  });

  it('ordena crítico primero y después por llegada', () => {
    const queue = [
      t('STABLE', '2026-10-03T10:00:00Z'),
      t('CRITICAL', '2026-10-03T10:30:00Z'),
      t('ATTENTION', '2026-10-03T10:10:00Z'),
      t('STABLE', '2026-10-03T09:50:00Z'),
    ].sort(compareQueueOrder);
    expect(queue.map((x) => `${x.triageLevel}@${x.checkedInAt.slice(11, 16)}`)).toEqual([
      'CRITICAL@10:30',
      'ATTENTION@10:10',
      'STABLE@09:50',
      'STABLE@10:00',
    ]);
  });
});
