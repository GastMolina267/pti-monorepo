import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  REALTIME_ERROR_EVENT,
  REALTIME_EVENTS,
  REALTIME_READY_EVENT,
  REALTIME_ROOMS,
  type AlertAcknowledgedEvent,
  type AlertEmergencyEvent,
  type QueueUpdatedEvent,
  type RealtimeEventName,
  type TelemetryReadingEvent,
  type TicketCalledEvent,
} from '@vitalia/contracts';
import { isUUID } from 'class-validator';
import type { Server, Socket } from 'socket.io';
import type { AuthUser, JwtPayload } from '../../common/auth/auth-user';

class HandshakeError extends Error {}

/**
 * Gateway Socket.IO (path `/socket.io`). Solo enruta: los services de dominio llaman a los
 * métodos `emit*` y el gateway decide la sala. No tiene lógica de negocio.
 *
 * Salas según el handshake (`RealtimeHandshakeAuth`):
 * - `{ token }` → `staff` (JWT del personal). Único destino de signos vitales y alertas.
 * - `{ role: 'tv' }` → `tv` (sin datos clínicos).
 * - `{ ticketId }` → `patient:<ticketId>`.
 * La CORS la configura `RealtimeIoAdapter` con `CORS_ORIGINS`.
 */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer() private readonly server?: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const room = await this.resolveRoom(client);
      await client.join(room);
      client.emit(REALTIME_READY_EVENT, { room });
      this.logger.debug(`Cliente ${client.id} en la sala ${room}`);
    } catch (err) {
      const message = err instanceof HandshakeError ? err.message : 'No se pudo abrir la conexión';
      client.emit(REALTIME_ERROR_EVENT, { message });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Cliente ${client.id} desconectado`);
  }

  emitTicketCalled(event: TicketCalledEvent): void {
    this.emit(
      [REALTIME_ROOMS.TV, REALTIME_ROOMS.STAFF, REALTIME_ROOMS.patient(event.ticketId)],
      REALTIME_EVENTS.TICKET_CALLED,
      event,
    );
  }

  emitQueueUpdated(event: QueueUpdatedEvent): void {
    this.emit([REALTIME_ROOMS.STAFF, REALTIME_ROOMS.TV], REALTIME_EVENTS.QUEUE_UPDATED, event);
  }

  /** Signos vitales: solo `staff`. */
  emitTelemetryReading(event: TelemetryReadingEvent): void {
    this.emit([REALTIME_ROOMS.STAFF], REALTIME_EVENTS.TELEMETRY_READING, event);
  }

  emitAlertEmergency(event: AlertEmergencyEvent): void {
    this.emit([REALTIME_ROOMS.STAFF], REALTIME_EVENTS.ALERT_EMERGENCY, event);
  }

  emitAlertAcknowledged(event: AlertAcknowledgedEvent): void {
    this.emit([REALTIME_ROOMS.STAFF], REALTIME_EVENTS.ALERT_ACKNOWLEDGED, event);
  }

  private async resolveRoom(client: Socket): Promise<string> {
    const auth = (client.handshake.auth ?? {}) as Record<string, unknown>;

    if (typeof auth['token'] === 'string' && auth['token']) {
      let payload: JwtPayload;
      try {
        payload = await this.jwt.verifyAsync<JwtPayload>(auth['token']);
      } catch {
        throw new HandshakeError('Token inválido o vencido');
      }
      const user: AuthUser = {
        id: payload.sub,
        email: payload.email,
        fullName: payload.name,
        role: payload.role,
      };
      client.data['user'] = user;
      return REALTIME_ROOMS.STAFF;
    }
    if (auth['role'] === 'tv') return REALTIME_ROOMS.TV;
    if (typeof auth['ticketId'] === 'string' && isUUID(auth['ticketId'], '4')) {
      return REALTIME_ROOMS.patient(auth['ticketId']);
    }
    throw new HandshakeError('Conexión sin credenciales: mandá { token }, { role: "tv" } o { ticketId }');
  }

  /** Nunca lanza: un problema de WebSocket no puede romper un llamado ni la ingesta. */
  private emit(rooms: string[], event: RealtimeEventName, payload: unknown): void {
    if (!this.server) return;
    try {
      this.server.to(rooms).emit(event, payload);
    } catch (err) {
      this.logger.error(`No se pudo emitir ${event}: ${(err as Error).message}`);
    }
  }
}
