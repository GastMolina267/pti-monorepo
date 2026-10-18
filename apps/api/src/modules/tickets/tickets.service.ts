import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  canTransition,
  compareQueueOrder,
  formatTicketCode,
  OPEN_TICKET_STATUSES,
  RECENT_CALLS_LIMIT,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  TRIAGE_LEVELS,
  type CheckInRequest,
  type QueueChange,
  type PublicTicket,
  type RecentCallsResponse,
  type Ticket,
  type TicketQuery,
  type TicketStatus,
  type TriageLevel,
} from '@vitalia/contracts';
import { DataSource, In, IsNull, Not, QueryFailedError, Repository } from 'typeorm';
import type { AuthUser } from '../../common/auth/auth-user';
import { toDayKey } from '../../common/time/day-key';
import type { Env } from '../../config/env.schema';
import { ConsultingRoomEntity } from '../catalog/entities/consulting-room.entity';
import { ServiceAreaEntity } from '../catalog/entities/service-area.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WearablesService } from '../wearables/wearables.service';
import { PatientEntity } from './entities/patient.entity';
import { TicketEntity } from './entities/ticket.entity';
import { toPublicTicket, toTicket } from './tickets.mapper';

const RELATIONS = { service: true, patient: true, consultingRoom: true } as const;
const MAX_NUMBER_RETRIES = 3;

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError && (err.driverError as { code?: string } | undefined)?.code === '23505'
  );
}

/** Al pasar a estos estados, la pulsera del turno se libera. */
const RELEASES_WEARABLE: readonly TicketStatus[] = ['DONE', 'CANCELLED'];

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @InjectRepository(TicketEntity) private readonly tickets: Repository<TicketEntity>,
    @InjectRepository(ServiceAreaEntity) private readonly services: Repository<ServiceAreaEntity>,
    @InjectRepository(ConsultingRoomEntity) private readonly rooms: Repository<ConsultingRoomEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService<Env, true>,
    private readonly realtime: RealtimeGateway,
    private readonly wearables: WearablesService,
  ) {}

  private today(): string {
    return toDayKey(new Date(), this.config.get('HOSPITAL_TIMEZONE', { infer: true }));
  }

  /**
   * Check-in (RF-O5): busca o crea al paciente y emite un turno numerado por servicio y día.
   * Idempotente por DNI: si el paciente ya tiene un turno abierto hoy en ese servicio, lo devuelve.
   */
  async checkIn(req: CheckInRequest): Promise<PublicTicket> {
    const service = await this.services.findOneBy({
      code: req.serviceCode.trim().toUpperCase(),
      active: true,
    });
    if (!service) throw new NotFoundException('El servicio elegido no existe o no está disponible');
    const dayKey = this.today();

    for (let attempt = 1; ; attempt++) {
      try {
        const ticketId = await this.dataSource.transaction(async (m) => {
          const documentNumber = req.documentNumber?.trim() || null;
          let patient = documentNumber ? await m.findOneBy(PatientEntity, { documentNumber }) : null;

          if (patient) {
            const open = await m.findOneBy(TicketEntity, {
              patientId: patient.id,
              serviceId: service.id,
              dayKey,
              status: In([...OPEN_TICKET_STATUSES]),
            });
            if (open) return open.id;
          } else {
            patient = await m.save(
              m.create(PatientEntity, {
                firstName: req.firstName.trim(),
                lastName: req.lastName.trim(),
                documentNumber,
              }),
            );
          }

          const raw = await m
            .createQueryBuilder(TicketEntity, 't')
            .select('COALESCE(MAX(t.number), 0)', 'max')
            .where('t.serviceId = :serviceId AND t.dayKey = :dayKey', { serviceId: service.id, dayKey })
            .getRawOne<{ max: string | number }>();
          const number = Number(raw?.max ?? 0) + 1;

          const ticket = await m.save(
            m.create(TicketEntity, {
              code: formatTicketCode(service.prefix, number),
              number,
              dayKey,
              status: 'WAITING',
              triageLevel: 'STABLE',
              source: req.source,
              reason: req.reason?.trim() || null,
              serviceId: service.id,
              patientId: patient.id,
            }),
          );
          return ticket.id;
        });
        const ticket = await this.getEntity(ticketId);
        this.notifyQueue('CHECK_IN', ticket);
        return this.toPublic(ticket);
      } catch (err) {
        // Dos check-ins simultáneos pueden competir por el mismo número: reintentar.
        if (isUniqueViolation(err) && attempt < MAX_NUMBER_RETRIES) continue;
        throw err;
      }
    }
  }

  /** Turnos del día operativo, ordenados como la fila (triaje → llegada). */
  async list(query: TicketQuery): Promise<Ticket[]> {
    const statuses = this.parseStatuses(query.status);
    const rows = await this.tickets.find({
      where: {
        dayKey: this.today(),
        status: In(statuses),
        ...(query.serviceCode ? { service: { code: query.serviceCode.toUpperCase() } } : {}),
      },
      relations: RELATIONS,
    });
    return rows.map(toTicket).sort(compareQueueOrder);
  }

  /** Últimos llamados del día para la TV (sin datos clínicos), el más reciente primero. */
  async recentCalls(): Promise<RecentCallsResponse> {
    const rows = await this.tickets.find({
      where: { dayKey: this.today(), calledAt: Not(IsNull()), consultingRoomId: Not(IsNull()) },
      relations: { consultingRoom: true, calledBy: true },
      order: { calledAt: 'DESC' },
      take: RECENT_CALLS_LIMIT,
    });
    return rows.map((t) => ({
      ticketId: t.id,
      ticketCode: t.code,
      consultingRoom: t.consultingRoom?.name ?? '',
      ...(t.calledBy ? { professionalName: t.calledBy.fullName } : {}),
      calledAt: (t.calledAt as Date).toISOString(),
    }));
  }

  async findOne(id: string): Promise<Ticket> {
    return toTicket(await this.getEntity(id));
  }

  /** Vista pública para el paciente (sin datos clínicos), con posición y espera estimada. */
  async getPublic(id: string): Promise<PublicTicket> {
    return this.toPublic(await this.getEntity(id));
  }

  private async toPublic(ticket: TicketEntity): Promise<PublicTicket> {
    return toPublicTicket(
      ticket,
      await this.positionOf(ticket),
      this.config.get('AVG_CONSULT_MINUTES', { infer: true }),
    );
  }

  /** Llamar a consultorio (también sirve para "volver a llamar"). */
  async call(id: string, consultingRoomId: string, user: AuthUser): Promise<Ticket> {
    const ticket = await this.getEntity(id);
    this.assertTransition(ticket.status, 'CALLED');
    const room = await this.rooms.findOneBy({ id: consultingRoomId, active: true });
    if (!room) throw new NotFoundException('Consultorio no encontrado');

    const calledAt = new Date();
    await this.tickets.update(id, {
      status: 'CALLED',
      calledAt,
      consultingRoomId: room.id,
      calledById: user.id,
    });
    // Primero el llamado (TV, staff, paciente: objetivo < 100 ms), después el resto.
    this.realtime.emitTicketCalled({
      ticketId: id,
      ticketCode: ticket.code,
      consultingRoom: room.name,
      professionalName: user.fullName,
      calledAt: calledAt.toISOString(),
    });
    void this.wearables.showTicket(id, { ticketCode: ticket.code, consultingRoom: room.name });
    const updated = await this.getEntity(id);
    this.notifyQueue('CALLED', updated);
    return toTicket(updated);
  }

  async updateStatus(id: string, status: TicketStatus): Promise<Ticket> {
    if (status === 'CALLED')
      throw new BadRequestException('Para llamar un turno usá POST /api/tickets/:id/call');
    const ticket = await this.getEntity(id);
    this.assertTransition(ticket.status, status);

    const now = new Date();
    const changes: Partial<TicketEntity> = { status };
    if (status === 'IN_PROGRESS') changes.startedAt = now;
    if (status === 'DONE' || status === 'NO_SHOW' || status === 'CANCELLED') changes.finishedAt = now;
    if (status === 'WAITING')
      Object.assign(changes, { calledAt: null, consultingRoomId: null, calledById: null, finishedAt: null });

    await this.tickets.update(id, changes);
    if (RELEASES_WEARABLE.includes(status)) {
      await this.wearables.releaseByTicket(id);
    }
    const updated = await this.getEntity(id);
    this.notifyQueue('STATUS', updated);
    return toTicket(updated);
  }

  /** Triaje manual por enfermería: puede subirlo o bajarlo (la telemetría solo lo sube). */
  async updateTriage(id: string, triageLevel: TriageLevel): Promise<Ticket> {
    const ticket = await this.getEntity(id);
    if (!OPEN_TICKET_STATUSES.includes(ticket.status)) {
      throw new ConflictException(
        `No se puede cambiar el triaje de un turno ${TICKET_STATUS_LABELS[ticket.status].toLowerCase()}`,
      );
    }
    await this.tickets.update(id, { triageLevel });
    const updated = await this.getEntity(id);
    this.notifyQueue('TRIAGE', updated);
    return toTicket(updated);
  }

  /**
   * Escalado automático desde la telemetría: sube el triaje de un turno abierto si la lectura
   * es más grave, **nunca lo baja** (bajar es decisión de enfermería, `PATCH /triage`).
   * Devuelve `true` si cambió.
   */
  async escalateTriage(id: string, level: TriageLevel): Promise<boolean> {
    const lower = TRIAGE_LEVELS.slice(0, TRIAGE_LEVELS.indexOf(level));
    if (lower.length === 0) return false;
    const result = await this.tickets.update(
      { id, status: In([...OPEN_TICKET_STATUSES]), triageLevel: In(lower) },
      { triageLevel: level },
    );
    if (!result.affected) return false;
    this.notifyQueue('TRIAGE', await this.getEntity(id));
    return true;
  }

  /** `queue:updated` a staff y TV, fuera del camino de la respuesta (cuenta la espera). */
  private notifyQueue(change: QueueChange, ticket: TicketEntity): void {
    this.tickets
      .countBy({ serviceId: ticket.serviceId, dayKey: ticket.dayKey, status: 'WAITING' })
      .then((waitingCount) =>
        this.realtime.emitQueueUpdated({
          change,
          ticketId: ticket.id,
          ticketCode: ticket.code,
          serviceCode: ticket.service.code,
          status: ticket.status,
          waitingCount,
          at: new Date().toISOString(),
        }),
      )
      .catch((err: Error) => this.logger.warn(`No se pudo avisar el cambio de la fila: ${err.message}`));
  }

  private async getEntity(id: string): Promise<TicketEntity> {
    const ticket = await this.tickets.findOne({ where: { id }, relations: RELATIONS });
    if (!ticket) throw new NotFoundException('Turno no encontrado');
    return ticket;
  }

  /** Cantidad de pacientes delante en la fila del mismo servicio (null si ya no espera). */
  private async positionOf(ticket: TicketEntity): Promise<number | null> {
    if (ticket.status !== 'WAITING') return null;
    const waiting = await this.tickets.find({
      select: { id: true, triageLevel: true, checkedInAt: true },
      where: { serviceId: ticket.serviceId, dayKey: ticket.dayKey, status: 'WAITING' },
    });
    const ordered = waiting
      .map((t) => ({ id: t.id, triageLevel: t.triageLevel, checkedInAt: t.checkedInAt.toISOString() }))
      .sort(compareQueueOrder);
    return Math.max(
      0,
      ordered.findIndex((t) => t.id === ticket.id),
    );
  }

  private assertTransition(from: TicketStatus, to: TicketStatus): void {
    if (!canTransition(from, to)) {
      throw new ConflictException(
        `No se puede pasar un turno de "${TICKET_STATUS_LABELS[from]}" a "${TICKET_STATUS_LABELS[to]}"`,
      );
    }
  }

  private parseStatuses(raw?: string): TicketStatus[] {
    if (!raw) return [...OPEN_TICKET_STATUSES];
    const list = raw.split(',').map((s) => s.trim().toUpperCase());
    const invalid = list.filter((s) => !(TICKET_STATUSES as readonly string[]).includes(s));
    if (invalid.length) throw new BadRequestException(`Estado(s) inválido(s): ${invalid.join(', ')}`);
    return list as TicketStatus[];
  }
}
