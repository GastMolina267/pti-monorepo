import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { REALTIME_EVENTS, REALTIME_ERROR_EVENT, REALTIME_READY_EVENT } from '@vitalia/contracts';
import { FakeSocket } from '../../../testing/fake-socket';
import { AuthService } from '../auth/auth.service';
import { RealtimeService, SOCKET_FACTORY } from './realtime.service';

function setup(initialToken: string | null) {
  const token = signal<string | null>(initialToken);
  const logout = vi.fn(() => token.set(null));
  const sockets: FakeSocket[] = [];
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { token, logout } },
      {
        provide: SOCKET_FACTORY,
        useValue: (auth: unknown) => {
          const s = new FakeSocket(auth);
          sockets.push(s);
          return s.asSocket();
        },
      },
    ],
  });
  const service = TestBed.inject(RealtimeService);
  TestBed.tick();
  return { service, sockets, token, logout };
}

describe('RealtimeService', () => {
  it('sin sesión no conecta', () => {
    const { service, sockets } = setup(null);
    expect(sockets).toHaveLength(0);
    expect(service.state()).toBe('offline');
  });

  it('conecta con el JWT, pasa a "live" con realtime:ready y reenvía los eventos', () => {
    const { service, sockets } = setup('jwt');
    expect(sockets[0].auth).toEqual({ token: 'jwt' });
    expect(service.state()).toBe('connecting');

    const ready = vi.fn();
    const calls: unknown[] = [];
    service.ready$.subscribe(ready);
    service.on(REALTIME_EVENTS.TICKET_CALLED).subscribe((e) => calls.push(e));

    sockets[0].fire(REALTIME_READY_EVENT, { room: 'staff' });
    expect(service.state()).toBe('live');
    expect(ready).toHaveBeenCalledOnce();

    sockets[0].fire(REALTIME_EVENTS.TICKET_CALLED, { ticketCode: 'A-024' });
    sockets[0].fire(REALTIME_EVENTS.QUEUE_UPDATED, {});
    expect(calls).toEqual([{ ticketCode: 'A-024' }]);

    sockets[0].fire('disconnect');
    expect(service.state()).toBe('connecting');
  });

  it('ante realtime:error cierra la sesión y desconecta', () => {
    const { service, sockets, logout } = setup('vencido');
    sockets[0].fire(REALTIME_ERROR_EVENT, { message: 'Token inválido o vencido' });
    expect(logout).toHaveBeenCalledWith('expired');
    TestBed.tick();
    expect(sockets[0].disconnected).toBe(true);
    expect(service.state()).toBe('offline');
  });

  it('reconecta con el token nuevo si cambia la sesión', () => {
    const { sockets, token } = setup('a');
    token.set('b');
    TestBed.tick();
    expect(sockets).toHaveLength(2);
    expect(sockets[0].disconnected).toBe(true);
    expect(sockets[1].auth).toEqual({ token: 'b' });
  });
});
