import type { Ticket } from '@vitalia/contracts';
import type { WearableView } from '../../core/live/wearables.store';
import { assignableTickets } from '../wearables/assign-wearable-dialog';
import { filterTickets } from '../tickets/tickets';
import { toRows } from './triage';

const t = (id: string, patch: Partial<Ticket> = {}): Ticket => ({
  id,
  code: id,
  status: 'WAITING',
  triageLevel: 'STABLE',
  source: 'KIOSK',
  service: { id: 's', code: 'CLINICA', name: 'Clínica Médica', prefix: 'A' },
  patient: { id: 'p', displayName: 'Lucía G.' },
  checkedInAt: '2026-10-18T12:00:00.000Z',
  ...patch,
});

describe('toRows', () => {
  it('une cada turno con su pulsera y el motivo más grave', () => {
    const w = {
      id: 'w',
      assessment: { level: 'CRITICAL', reasons: ['Caída detectada', 'Fiebre'] },
    } as WearableView;
    const rows = toRows([t('A-001'), t('A-002')], new Map([['A-001', w]]));
    expect(rows[0]).toMatchObject({ wearable: w, reason: 'Caída detectada' });
    expect(rows[1]).toMatchObject({ wearable: null, reason: null });
  });
});

describe('filterTickets', () => {
  it('filtra por estado y por texto', () => {
    const list = [
      t('A-001'),
      t('A-002', { status: 'DONE', patient: { id: 'p2', displayName: 'Martín R.' } }),
    ];
    expect(filterTickets(list, 'DONE', '').map((x) => x.id)).toEqual(['A-002']);
    expect(filterTickets(list, null, 'martín').map((x) => x.id)).toEqual(['A-002']);
    expect(filterTickets(list, null, 'a-00')).toHaveLength(2);
  });
});

describe('assignableTickets', () => {
  it('excluye los turnos que ya tienen pulsera', () => {
    expect(assignableTickets([t('A-001'), t('A-002')], new Set(['A-001'])).map((x) => x.id)).toEqual([
      'A-002',
    ]);
  });
});
