import type { JwtService } from '@nestjs/jwt';
import { REALTIME_ERROR_EVENT, REALTIME_EVENTS, REALTIME_READY_EVENT } from '@vitalia/contracts';
import type { Socket } from 'socket.io';
import { RealtimeGateway } from './realtime.gateway';

const TICKET = '3c3c3c3c-0000-4000-8000-000000000001';

function socket(auth: Record<string, unknown>) {
  return {
    id: 's1',
    handshake: { auth },
    data: {} as Record<string, unknown>,
    join: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

function setup() {
  const jwt = {
    verifyAsync: jest.fn(async (token: string) => {
      if (token !== 'valido') throw new Error('jwt malformed');
      return { sub: 'u1', email: 'medico@vitalia.local', name: 'Dra. Ruiz', role: 'DOCTOR' };
    }),
  };
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  const gateway = new RealtimeGateway(jwt as unknown as JwtService);
  Object.assign(gateway, { server: { to } });
  return { gateway, to, emit };
}

describe('RealtimeGateway', () => {
  it.each([
    [{ token: 'valido' }, 'staff'],
    [{ role: 'tv' }, 'tv'],
    [{ ticketId: TICKET }, `patient:${TICKET}`],
  ])('une el handshake %j a la sala %s', async (auth, room) => {
    const s = socket(auth);
    await setup().gateway.handleConnection(s as unknown as Socket);
    expect(s.join).toHaveBeenCalledWith(room);
    expect(s.emit).toHaveBeenCalledWith(REALTIME_READY_EVENT, { room });
    expect(s.disconnect).not.toHaveBeenCalled();
  });

  it.each([[{ token: 'vencido' }], [{}], [{ ticketId: 'no-es-uuid' }], [{ role: 'admin' }]])(
    'rechaza el handshake %j',
    async (auth) => {
      const s = socket(auth);
      await setup().gateway.handleConnection(s as unknown as Socket);
      expect(s.join).not.toHaveBeenCalled();
      expect(s.emit).toHaveBeenCalledWith(REALTIME_ERROR_EVENT, { message: expect.any(String) });
      expect(s.disconnect).toHaveBeenCalledWith(true);
    },
  );

  it('ticket:called va a TV, staff y al paciente; las alertas y lecturas solo a staff', () => {
    const { gateway, to, emit } = setup();
    gateway.emitTicketCalled({
      ticketId: TICKET,
      ticketCode: 'A-024',
      consultingRoom: 'Consultorio 4',
      calledAt: new Date().toISOString(),
    });
    expect(to).toHaveBeenLastCalledWith(['tv', 'staff', `patient:${TICKET}`]);
    expect(emit).toHaveBeenLastCalledWith(REALTIME_EVENTS.TICKET_CALLED, expect.anything());

    gateway.emitAlertEmergency({} as never);
    expect(to).toHaveBeenLastCalledWith(['staff']);
    gateway.emitTelemetryReading({} as never);
    expect(to).toHaveBeenLastCalledWith(['staff']);
    gateway.emitQueueUpdated({} as never);
    expect(to).toHaveBeenLastCalledWith(['staff', 'tv']);
  });

  it('emitir sin servidor (o con error) no lanza', () => {
    const gateway = new RealtimeGateway({} as JwtService);
    expect(() => gateway.emitAlertAcknowledged({} as never)).not.toThrow();
    Object.assign(gateway, {
      server: {
        to: () => {
          throw new Error('boom');
        },
      },
    });
    expect(() => gateway.emitQueueUpdated({} as never)).not.toThrow();
  });
});
