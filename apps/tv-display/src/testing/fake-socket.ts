import type { Socket } from 'socket.io-client';

/** Doble de `socket.io-client` para tests: `fire()` simula un evento del servidor. */
export class FakeSocket {
  readonly handlers = new Map<string, ((payload?: unknown) => void)[]>();
  readonly anyHandlers: ((event: string, payload?: unknown) => void)[] = [];
  disconnected = false;

  constructor(readonly auth: unknown) {}

  on(event: string, cb: (payload?: unknown) => void): this {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), cb]);
    return this;
  }
  onAny(cb: (event: string, payload?: unknown) => void): this {
    this.anyHandlers.push(cb);
    return this;
  }
  removeAllListeners(): this {
    this.handlers.clear();
    this.anyHandlers.length = 0;
    return this;
  }
  disconnect(): this {
    this.disconnected = true;
    return this;
  }
  fire(event: string, payload?: unknown): void {
    for (const cb of this.handlers.get(event) ?? []) cb(payload);
    for (const cb of this.anyHandlers) cb(event, payload);
  }
  asSocket(): Socket {
    return this as unknown as Socket;
  }
}
