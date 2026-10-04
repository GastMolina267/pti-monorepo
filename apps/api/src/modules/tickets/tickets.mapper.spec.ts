import type { TicketEntity } from './entities/ticket.entity';
import { displayName, toPublicTicket, toTicket } from './tickets.mapper';

const entity = {
  id: 't-1',
  code: 'A-024',
  status: 'WAITING',
  triageLevel: 'ATTENTION',
  source: 'CAPTIVE_PORTAL',
  reason: null,
  service: { id: 's-1', code: 'CLINICA', name: 'Clínica Médica', prefix: 'A', active: true },
  patient: {
    id: 'p-1',
    firstName: 'Lucía',
    lastName: 'gómez',
    documentNumber: '30123456',
    createdAt: new Date(),
  },
  consultingRoom: null,
  checkedInAt: new Date('2026-10-03T13:00:00Z'),
  calledAt: null,
  startedAt: null,
  finishedAt: null,
} as unknown as TicketEntity;

describe('tickets.mapper', () => {
  it('displayName solo muestra la inicial del apellido', () => {
    expect(displayName({ firstName: 'Lucía', lastName: 'gómez' })).toBe('Lucía G.');
  });

  it('toTicket no expone el DNI ni el apellido completo', () => {
    const t = toTicket(entity);
    expect(t.patient).toEqual({ id: 'p-1', displayName: 'Lucía G.' });
    expect(JSON.stringify(t)).not.toContain('30123456');
    expect(t.checkedInAt).toBe('2026-10-03T13:00:00.000Z');
  });

  it('toPublicTicket calcula la espera estimada', () => {
    expect(toPublicTicket(entity, 3, 12)).toMatchObject({
      position: 3,
      estimatedWaitMinutes: 36,
      serviceName: 'Clínica Médica',
    });
    expect(toPublicTicket(entity, null, 12)).toMatchObject({ position: null, estimatedWaitMinutes: null });
  });
});
