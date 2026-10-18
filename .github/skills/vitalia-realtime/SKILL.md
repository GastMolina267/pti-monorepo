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
| `queue:updated` | API → `staff`, `tv` | `QueueUpdatedEvent` (aviso sin triaje: re-consultar la fila) |
| `telemetry:reading` | API → `staff` | `TelemetryReadingEvent` (lectura + `assessment`) |
| `alert:emergency` | API → `staff` | `AlertEmergencyEvent` |
| `alert:acknowledged` | API → `staff` | `AlertAcknowledgedEvent { alertId, by: { id, fullName }, at }` |
| `realtime:ready` / `realtime:error` | API → el cliente que se conecta | `{ room }` / `{ message }` (y se desconecta) |

Handshake (`RealtimeHandshakeAuth`): `{ token }` → `staff` · `{ role: 'tv' }` → `tv` · `{ ticketId }` → `patient:<ticketId>`.

## Backend (✅ Fase 2): `apps/api/src/modules/realtime/`

- `realtime.gateway.ts`: valida el JWT del handshake con `JwtService` (global), une a la sala, emite `realtime:ready`. Métodos `emitTicketCalled`, `emitQueueUpdated`, `emitTelemetryReading`, `emitAlertEmergency`, `emitAlertAcknowledged`: eligen la sala y **nunca lanzan** (sin servidor o con error, solo loguean).
- `realtime.module.ts` es `@Global()`: los services inyectan `RealtimeGateway` sin importar el módulo. **El gateway no tiene lógica de negocio.**
- `realtime-io.adapter.ts`: CORS de Socket.IO = `CORS_ORIGINS` (se registra en `main.ts`).
- Quién emite: `TicketsService` (`ticket:called` en el llamado; `queue:updated` en check-in, llamado, estado y triaje), `TelemetryService` (`telemetry:reading`), `AlertsService` (`alert:emergency`, `alert:acknowledged`).
- Path por defecto `/socket.io` (los proxies dev de Angular ya lo redirigen a :3000).
- Evento nuevo: agregalo a `REALTIME_EVENTS` (contracts), un método `emit*` en el gateway con su sala, test en `realtime.gateway.spec.ts` y la tabla de `docs/04-contratos.md`.

## Cliente Angular (Fase 3)

```bash
pnpm add socket.io-client
```

```ts
// apps/<app>/src/app/core/realtime/realtime.service.ts
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  // Backoffice: auth: { token } (JWT del login). Si cambia el token, reconectar con el nuevo.
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
- Esperá `realtime:ready` antes de dar la conexión por buena; ante `realtime:error` (token vencido) volvé al login.
- Tests: gateway con mock de `Server` (`realtime.gateway.spec.ts`), integración con `socket.io-client` real en `app.int.spec.ts`, y en el cliente Angular mock de `socket.io-client`.
