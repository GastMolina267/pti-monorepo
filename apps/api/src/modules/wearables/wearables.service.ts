import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DEFAULT_WEARABLE_ROOM,
  MQTT_TOPICS,
  OPEN_TICKET_STATUSES,
  parseWearableCode,
  TICKET_STATUS_LABELS,
  type CreateWearableRequest,
  type UpdateWearableRequest,
  type Wearable,
  type WearableCommand,
} from '@vitalia/contracts';
import { In, QueryFailedError, Repository } from 'typeorm';
import { TelemetryReadingEntity } from '../iomt/entities/telemetry-reading.entity';
import { WearableEntity } from '../iomt/entities/wearable.entity';
import { MqttService } from '../mqtt/mqtt.service';
import { TicketEntity } from '../tickets/entities/ticket.entity';
import { toWearable } from './wearables.mapper';

const RELATIONS = { ticket: { patient: true } } as const;

/** Lo que la ingesta necesita saber del wearable de una lectura. */
export interface IngestWearable {
  id: string;
  code: string;
  ticketId: string | null;
  ticketCode: string | null;
  patientId: string | null;
  /** Última lectura antes de esta: un hueco largo indica que la pulsera reinició o se desconectó. */
  lastSeenAt: Date | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Estado completo de la pulsera según la base (ADR 0021): libre, llamada (con consultorio) o
 * asignada. Si lo último que se le mandó fue el llamado de ese mismo turno, "asignada" sale
 * como `CLEAR_TICKET` (en el firmware deja el mismo estado que `ASSIGN_TICKET`).
 */
export function commandFor(
  ticket: Pick<TicketEntity, 'code' | 'status' | 'consultingRoom'> | null,
  lastSent?: WearableCommand,
): WearableCommand {
  if (!ticket) return { type: 'RELEASE_WEARABLE' };
  if (ticket.status === 'CALLED' && ticket.consultingRoom)
    return { type: 'SHOW_TICKET', ticketCode: ticket.code, consultingRoom: ticket.consultingRoom.name };
  return lastSent?.type === 'SHOW_TICKET' && lastSent.ticketCode === ticket.code
    ? { type: 'CLEAR_TICKET', ticketCode: ticket.code }
    : { type: 'ASSIGN_TICKET', ticketCode: ticket.code };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError && (err.driverError as { code?: string } | undefined)?.code === '23505'
  );
}

@Injectable()
export class WearablesService {
  private readonly logger = new Logger(WearablesService.name);
  /** Una cola por pulsera: cada sincronización espera a la anterior. */
  private readonly queues = new Map<string, Promise<boolean>>();
  /** Último comando publicado a cada pulsera (CLEAR o ASSIGN). Se pierde al reiniciar la API. */
  private readonly lastSent = new Map<string, WearableCommand>();

  constructor(
    @InjectRepository(WearableEntity) private readonly wearables: Repository<WearableEntity>,
    @InjectRepository(TelemetryReadingEntity) private readonly readings: Repository<TelemetryReadingEntity>,
    @InjectRepository(TicketEntity) private readonly tickets: Repository<TicketEntity>,
    private readonly mqtt: MqttService,
  ) {}

  /** Todas las pulseras con su turno y su última lectura. */
  async list(): Promise<Wearable[]> {
    const rows = await this.wearables.find({ relations: RELATIONS, order: { code: 'ASC' } });
    const last = await this.lastReadings(rows.map((w) => w.id));
    const now = Date.now();
    return rows.map((w) => toWearable(w, last.get(w.id) ?? null, now));
  }

  async findOne(id: string): Promise<Wearable> {
    const w = await this.getEntity(id);
    return toWearable(w, (await this.lastReadings([w.id])).get(w.id) ?? null);
  }

  /** Alta (ADR 0011): el código respeta `wb-<NN>-<mac>` y el número físico no se repite. */
  async create(req: CreateWearableRequest): Promise<Wearable> {
    const code = req.code.trim().toLowerCase();
    const parts = parseWearableCode(code);
    if (!parts) throw new BadRequestException('El código tiene que ser wb-<NN>-<mac>, ej. wb-07-24d7cc');

    const sameNumber = await this.wearables
      .createQueryBuilder('w')
      .where('w.code LIKE :prefix', { prefix: `wb-${pad(parts.number)}-%` })
      .getOne();
    if (sameNumber) {
      throw new ConflictException(
        sameNumber.code === code
          ? `La pulsera ${code} ya está registrada`
          : `Ya existe la pulsera N° ${pad(parts.number)} (${sameNumber.code}): usá otro número`,
      );
    }
    try {
      const saved = await this.wearables.save(
        this.wearables.create({ code, label: req.label?.trim() || null, status: 'AVAILABLE' }),
      );
      return this.findOne(saved.id);
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException(`La pulsera ${code} ya está registrada`);
      throw err;
    }
  }

  /**
   * Entrega la pulsera a un paciente con turno abierto. El OLED muestra el código del turno
   * (`ASSIGN_TICKET`) o, si ya lo llamaron, el llamado (`SHOW_TICKET`).
   */
  async assign(id: string, ticketId: string): Promise<Wearable> {
    const wearable = await this.getEntity(id);
    if (wearable.ticketId === ticketId) return this.findOne(id);
    if (wearable.status === 'MAINTENANCE') throw new ConflictException('La pulsera está en mantenimiento');
    if (wearable.ticket) {
      throw new ConflictException(
        `La pulsera ya está asignada al turno ${wearable.ticket.code}: liberala antes de reasignarla`,
      );
    }

    const ticket = await this.tickets.findOne({
      where: { id: ticketId },
      relations: { consultingRoom: true },
    });
    if (!ticket) throw new NotFoundException('Turno no encontrado');
    if (!OPEN_TICKET_STATUSES.includes(ticket.status)) {
      throw new ConflictException(
        `No se puede asignar una pulsera a un turno ${TICKET_STATUS_LABELS[ticket.status].toLowerCase()}`,
      );
    }
    const other = await this.wearables.findOneBy({ ticketId });
    if (other) throw new ConflictException(`El turno ${ticket.code} ya tiene la pulsera ${other.code}`);

    try {
      await this.wearables.update(id, { ticketId, status: 'ASSIGNED' });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException(`El turno ${ticket.code} ya tiene una pulsera`);
      throw err;
    }
    void this.syncState(id);
    return this.findOne(id);
  }

  /** Etiqueta y mantenimiento. Una pulsera asignada no pasa a mantenimiento: primero se libera. */
  async update(id: string, req: UpdateWearableRequest): Promise<Wearable> {
    const wearable = await this.getEntity(id);
    const changes: Partial<WearableEntity> = {};
    if (req.label !== undefined) changes.label = req.label?.trim() || null;
    if (req.status !== undefined && req.status !== wearable.status) {
      if (wearable.ticket) {
        throw new ConflictException(
          `La pulsera está asignada al turno ${wearable.ticket.code}: liberala antes de cambiarle el estado`,
        );
      }
      changes.status = req.status;
    }
    if (Object.keys(changes).length) await this.wearables.update(id, changes);
    return this.findOne(id);
  }

  async release(id: string): Promise<Wearable> {
    await this.getEntity(id);
    await this.wearables.update(id, { ticketId: null, status: 'AVAILABLE' });
    void this.syncState(id); // RELEASE_WEARABLE
    return this.findOne(id);
  }

  /** Al terminar o cancelar un turno, la pulsera queda libre y el OLED vuelve a su pantalla. */
  async releaseByTicket(ticketId: string): Promise<void> {
    const wearable = await this.wearables.findOneBy({ ticketId });
    if (!wearable) return;
    await this.wearables.update(wearable.id, { ticketId: null, status: 'AVAILABLE' });
    void this.syncState(wearable.id); // RELEASE_WEARABLE
  }

  /**
   * Sincroniza la pulsera del turno, si tiene: al llamarlo (`SHOW_TICKET`) y cuando deja de
   * estar llamado (`CLEAR_TICKET`: en atención, de vuelta a la fila). No lanza.
   */
  async syncByTicket(ticketId: string): Promise<boolean> {
    try {
      const wearable = await this.wearables.findOneBy({ ticketId });
      return wearable ? await this.syncState(wearable.id) : false;
    } catch (err) {
      this.logger.warn(`No se pudo avisar a la pulsera del turno ${ticketId}: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Publica el estado actual de la pulsera, leído de la base en el momento de publicar
   * (ADR 0021). Las sincronizaciones de una misma pulsera van en orden, así el último comando
   * refleja el último estado guardado aunque los cambios se crucen (revisión del #20). También
   * reenvía el estado a una pulsera que reinició o estuvo desconectada (sin retain). No lanza.
   */
  syncState(id: string): Promise<boolean> {
    const next = (this.queues.get(id) ?? Promise.resolve(true)).then(() => this.publishState(id));
    this.queues.set(id, next);
    void next.finally(() => {
      if (this.queues.get(id) === next) this.queues.delete(id);
    });
    return next;
  }

  /** Búsqueda por código para cada mensaje MQTT (una query con índice único). */
  async findForIngest(code: string): Promise<IngestWearable | null> {
    const w = await this.wearables.findOne({
      select: {
        id: true,
        code: true,
        ticketId: true,
        lastSeenAt: true,
        ticket: { id: true, code: true, patientId: true },
      },
      where: { code },
      relations: { ticket: true },
    });
    if (!w) return null;
    return {
      id: w.id,
      code: w.code,
      ticketId: w.ticketId,
      ticketCode: w.ticket?.code ?? null,
      patientId: w.ticket?.patientId ?? null,
      lastSeenAt: w.lastSeenAt ?? null,
    };
  }

  /** Última vez que se la vio y en qué sala (para los comandos). */
  async touch(id: string, seenAt: Date, room: string): Promise<void> {
    await this.wearables.update(id, { lastSeenAt: seenAt, lastRoom: room });
  }

  private async publishState(id: string): Promise<boolean> {
    try {
      const wearable = await this.wearables.findOne({
        where: { id },
        relations: { ticket: { consultingRoom: true } },
      });
      if (!wearable) return false;
      const command = commandFor(wearable.ticket ?? null, this.lastSent.get(id));
      const sent = await this.sendCommand(wearable, command);
      if (sent) this.lastSent.set(id, command);
      return sent;
    } catch (err) {
      this.logger.warn(`No se pudo sincronizar el wearable ${id}: ${(err as Error).message}`);
      return false;
    }
  }

  private async sendCommand(
    wearable: Pick<WearableEntity, 'code' | 'lastRoom'>,
    command: WearableCommand,
  ): Promise<boolean> {
    const topic = MQTT_TOPICS.wearableCommand(wearable.lastRoom ?? DEFAULT_WEARABLE_ROOM, wearable.code);
    const sent = await this.mqtt.publishJson(topic, command);
    if (!sent && this.mqtt.isEnabled())
      this.logger.warn(`Sin broker: ${wearable.code} no recibió ${command.type}`);
    return sent;
  }

  private async getEntity(id: string): Promise<WearableEntity> {
    const w = await this.wearables.findOne({ where: { id }, relations: RELATIONS });
    if (!w) throw new NotFoundException('Pulsera no encontrada');
    return w;
  }

  private async lastReadings(ids: string[]): Promise<Map<string, TelemetryReadingEntity>> {
    if (ids.length === 0) return new Map();
    const rows = await this.readings
      .createQueryBuilder('r')
      .distinctOn(['r.wearable_id'])
      .where({ wearableId: In(ids) })
      .orderBy('r.wearable_id')
      .addOrderBy('r.seq', 'DESC')
      .getMany();
    return new Map(rows.map((r) => [r.wearableId, r]));
  }
}
