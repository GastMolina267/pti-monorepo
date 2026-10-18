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
  type ShowTicketCommand,
  type Wearable,
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
}

const pad = (n: number) => String(n).padStart(2, '0');

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError && (err.driverError as { code?: string } | undefined)?.code === '23505'
  );
}

@Injectable()
export class WearablesService {
  private readonly logger = new Logger(WearablesService.name);

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

  /** Entrega la pulsera a un paciente con turno abierto. Si ya lo llamaron, el OLED lo muestra. */
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
    if (ticket.status === 'CALLED' && ticket.consultingRoom) {
      void this.sendShowTicket(wearable, {
        ticketCode: ticket.code,
        consultingRoom: ticket.consultingRoom.name,
      });
    }
    return this.findOne(id);
  }

  async release(id: string): Promise<Wearable> {
    await this.getEntity(id);
    await this.wearables.update(id, { ticketId: null, status: 'AVAILABLE' });
    return this.findOne(id);
  }

  /** Al terminar o cancelar un turno, la pulsera queda libre. */
  async releaseByTicket(ticketId: string): Promise<void> {
    await this.wearables.update({ ticketId }, { ticketId: null, status: 'AVAILABLE' });
  }

  /**
   * Si el turno tiene pulsera, publica `SHOW_TICKET` en su tópico `.../cmd`. No lanza:
   * devuelve `false` si no hay pulsera o no hay conexión con el broker.
   */
  async showTicket(ticketId: string, cmd: Omit<ShowTicketCommand, 'type'>): Promise<boolean> {
    try {
      const wearable = await this.wearables.findOneBy({ ticketId });
      return wearable ? await this.sendShowTicket(wearable, cmd) : false;
    } catch (err) {
      this.logger.warn(
        `No se pudo avisar al wearable del turno ${cmd.ticketCode}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /** Búsqueda por código para cada mensaje MQTT (una query con índice único). */
  async findForIngest(code: string): Promise<IngestWearable | null> {
    const w = await this.wearables.findOne({
      select: { id: true, code: true, ticketId: true, ticket: { id: true, code: true, patientId: true } },
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
    };
  }

  /** Última vez que se la vio y en qué sala (para los comandos). */
  async touch(id: string, seenAt: Date, room: string): Promise<void> {
    await this.wearables.update(id, { lastSeenAt: seenAt, lastRoom: room });
  }

  private async sendShowTicket(
    wearable: Pick<WearableEntity, 'code' | 'lastRoom'>,
    cmd: Omit<ShowTicketCommand, 'type'>,
  ): Promise<boolean> {
    const command: ShowTicketCommand = { type: 'SHOW_TICKET', ...cmd };
    const topic = MQTT_TOPICS.wearableCommand(wearable.lastRoom ?? DEFAULT_WEARABLE_ROOM, wearable.code);
    const sent = await this.mqtt.publishJson(topic, command);
    if (!sent && this.mqtt.isEnabled())
      this.logger.warn(`Sin broker: ${wearable.code} no mostrará ${cmd.ticketCode}`);
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
