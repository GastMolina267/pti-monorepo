import { DestroyRef, effect, inject, Injectable, InjectionToken, signal, untracked } from '@angular/core';
import {
  REALTIME_ERROR_EVENT,
  REALTIME_READY_EVENT,
  type RealtimeEventName,
  type RealtimeHandshakeAuth,
} from '@vitalia/contracts';
import { filter, map, type Observable, Subject } from 'rxjs';
import { io, type Socket } from 'socket.io-client';
import { AuthService } from '../auth/auth.service';

/** Fábrica del socket (en tests se reemplaza por un doble). */
export const SOCKET_FACTORY = new InjectionToken<(auth: RealtimeHandshakeAuth) => Socket>('SOCKET_FACTORY', {
  providedIn: 'root',
  factory: () => (auth) => io({ path: '/socket.io', auth, reconnection: true, reconnectionDelayMax: 5000 }),
});

/** `connecting`: conectando o reconectando · `live`: unido a la sala `staff` · `offline`: sin sesión. */
export type ConnectionState = 'offline' | 'connecting' | 'live';

/**
 * Socket.IO del Backoffice (sala `staff`, skill `vitalia-realtime`). Se conecta solo cuando
 * hay sesión, con el JWT en el handshake, y se reconecta solo. `ready$` avisa cada vez que
 * el servidor confirma la sala (también después de reconectar): los stores vuelven a pedir
 * el estado para no perder lo que pasó mientras estaban desconectados.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private readonly createSocket = inject(SOCKET_FACTORY);
  private readonly events = new Subject<{ event: string; payload: unknown }>();
  private socket: Socket | null = null;

  readonly state = signal<ConnectionState>('offline');
  readonly ready$ = new Subject<void>();

  constructor() {
    effect(() => {
      const token = this.auth.token();
      untracked(() => (token ? this.connect(token) : this.disconnect()));
    });
    inject(DestroyRef).onDestroy(() => this.disconnect());
  }

  on<T>(event: RealtimeEventName): Observable<T> {
    return this.events.pipe(
      filter((e) => e.event === event),
      map((e) => e.payload as T),
    );
  }

  private connect(token: string): void {
    this.disconnect();
    this.state.set('connecting');
    const socket = this.createSocket({ token });
    this.socket = socket;

    socket.on(REALTIME_READY_EVENT, () => {
      this.state.set('live');
      this.ready$.next();
    });
    socket.on(REALTIME_ERROR_EVENT, () => this.auth.logout('expired'));
    socket.on('disconnect', () => this.state.set(this.socket === socket ? 'connecting' : 'offline'));
    socket.on('connect_error', () => this.state.set('connecting'));
    socket.onAny((event: string, payload: unknown) => this.events.next({ event, payload }));
  }

  private disconnect(): void {
    const socket = this.socket;
    this.socket = null;
    socket?.removeAllListeners();
    socket?.disconnect();
    this.state.set('offline');
  }
}
