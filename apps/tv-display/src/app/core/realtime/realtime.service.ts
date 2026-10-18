import { DestroyRef, inject, Injectable, InjectionToken, signal } from '@angular/core';
import {
  REALTIME_EVENTS,
  REALTIME_READY_EVENT,
  type RealtimeHandshakeAuth,
  type TicketCalledEvent,
} from '@vitalia/contracts';
import { Subject } from 'rxjs';
import { io, type Socket } from 'socket.io-client';

export const SOCKET_FACTORY = new InjectionToken<(auth: RealtimeHandshakeAuth) => Socket>('SOCKET_FACTORY', {
  providedIn: 'root',
  factory: () => (auth) =>
    io({ path: '/socket.io', auth, reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000 }),
});

export type ConnectionState = 'connecting' | 'live';

/**
 * Socket.IO de la TV: sala `tv` (sin login y sin datos clínicos). Se reconecta sola para
 * siempre; `ready$` avisa cada vez que el servidor confirma la sala, así la pantalla se
 * pone al día con `GET /api/tickets/recent-calls`.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly socket: Socket;
  readonly state = signal<ConnectionState>('connecting');
  readonly ready$ = new Subject<void>();
  readonly ticketCalled$ = new Subject<TicketCalledEvent>();

  constructor() {
    this.socket = inject(SOCKET_FACTORY)({ role: 'tv' });
    this.socket.on(REALTIME_READY_EVENT, () => {
      this.state.set('live');
      this.ready$.next();
    });
    this.socket.on('disconnect', () => this.state.set('connecting'));
    this.socket.on('connect_error', () => this.state.set('connecting'));
    this.socket.on(REALTIME_EVENTS.TICKET_CALLED, (e: TicketCalledEvent) => this.ticketCalled$.next(e));
    inject(DestroyRef).onDestroy(() => {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    });
  }
}
