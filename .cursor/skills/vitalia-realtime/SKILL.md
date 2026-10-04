---
name: vitalia-realtime
description: Implementar comunicación en tiempo real con Socket.IO entre la API NestJS y los clientes (Backoffice, TV llamador, portal del paciente) - gateway, salas, eventos ticket:called, queue:updated, telemetry:reading, alert:emergency, reconexión y cliente Angular. Usala para cualquier push del servidor al cliente o requisito de baja latencia.
---

# Tiempo real (Socket.IO)

Objetivos: llamado de turno < 100 ms a todas las pantallas; alerta crítica < 500 ms de punta a punta (Cuadro 11.1).

## Contrato

Los eventos y salas están en `@vitalia/contracts` → `REALTIME_EVENTS`, `REALTIME_ROOMS` y las interfaces `TicketCalledEvent`, `AlertEmergencyEvent`, etc. Un evento nuevo **se agrega ahí primero** (skill `vitalia-contracts`).

| Evento | Emisor → Sala | Payload |
| --- | --- | --- |
| `ticket:called` | API → `tv`, `staff`, `patient:<ticketId>` | `TicketCalledEvent` |
| `queue:updated` | API → `staff`, `tv` | resumen de la fila |
| `telemetry:reading` | API → `staff` | lectura + `assessVitals()` |
| `alert:emergency` | API → `staff` | `AlertEmergencyEvent` |
| `alert:acknowledged` | API → `staff` | `{ alertId, by, at }` |

## Backend (Fase 2)

```bash
pnpm add @nestjs/websockets@^11 @nestjs/platform-socket.io@^11 socket.io
```

```ts
// apps/api/src/modules/realtime/realtime.gateway.ts
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer() private server!: Server;

  handleConnection(client: Socket) {
    const role = client.handshake.auth?.['role']; // 'staff' (JWT) | 'tv' | 'patient'
    if (role === 'tv') void client.join(REALTIME_ROOMS.TV);
    // staff: validar JWT antes de unir a REALTIME_ROOMS.STAFF
  }

  emitTicketCalled(e: TicketCalledEvent) {
    this.server.to([REALTIME_ROOMS.TV, REALTIME_ROOMS.STAFF, REALTIME_ROOMS.patient(e.ticketId)])
      .emit(REALTIME_EVENTS.TICKET_CALLED, e);
  }
}
```

- `RealtimeModule` exporta el gateway. Los services de dominio lo inyectan para emitir. **El gateway no tiene lógica de negocio.**
- Path por defecto `/socket.io` (los proxies dev de Angular ya lo redirigen a :3000).

## Cliente Angular (Fase 3)

```bash
pnpm add socket.io-client
```

```ts
// apps/<app>/src/app/core/realtime/realtime.service.ts
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly socket = io({ path: '/socket.io', auth: { role: 'tv' }, reconnection: true });
  readonly connected = signal(false);

  constructor() {
    this.socket.on('connect', () => this.connected.set(true));
    this.socket.on('disconnect', () => this.connected.set(false));
    inject(DestroyRef).onDestroy(() => this.socket.disconnect());
  }

  on<T>(event: RealtimeEventName): Signal<T | undefined> {
    const s = signal<T | undefined>(undefined);
    this.socket.on(event, (payload: T) => s.set(payload));
    return s.asReadonly();
  }
}
```

## Reglas

- Mostrá el estado de conexión en la UI (punto vivo `--vt-live` / rojo) y conservá el último estado conocido si se corta.
- La TV no se autentica, pero solo recibe eventos públicos (sin datos clínicos).
- **Nunca** mandes signos vitales a salas de paciente o TV, solo a `staff`.
- Medí la latencia: incluí `detectedAt`/`calledAt` en los payloads y registrá la diferencia en el cliente (para la validación de la Fase 5).
- Tests: gateway con mock de `Server`, y en el cliente mock de `socket.io-client`.
