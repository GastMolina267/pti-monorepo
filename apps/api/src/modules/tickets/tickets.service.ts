import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  canTransition,
  compareQueueOrder,
  formatTicketCode,
  OPEN_TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  type CheckInRequest,
  type PublicTicket,
  type Ticket,
  type TicketQuery,
  type TicketStatus,
  type TriageLevel,
} from '@vitalia/contracts';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';
import type { AuthUser } from '../../common/auth/auth-user';
import { toDayKey } from '../../common/time/day-key';
import type { Env } from '../../config/env.schema';
import { ConsultingRoomEntity } from '../catalog/entities/consulting-room.entity';
import { ServiceAreaEntity } from '../catalog/entities/service-area.entity';
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

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(TicketEntity) private readonly tickets: Repository<TicketEntity>,
    @InjectRepository(ServiceAreaEntity) private readonly services: Repository<ServiceAreaEntity>,
    @InjectRepository(ConsultingRoomEntity) private readonly rooms: Repository<ConsultingRoomEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService<Env, true>,
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
        return this.getPublic(ticketId);
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

  async findOne(id: string): Promise<Ticket> {
    return toTicket(await this.getEntity(id));
  }

  /** Vista pública para el paciente (sin datos clínicos), con posición y espera estimada. */
  async getPublic(id: string): Promise<PublicTicket> {
    const ticket = await this.getEntity(id);
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

    await this.tickets.update(id, {
      status: 'CALLED',
      calledAt: new Date(),
      consultingRoomId: room.id,
      calledById: user.id,
    });
    // Fase 2: emitir REALTIME_EVENTS.TICKET_CALLED (TV, paciente, OLED del wearable).
    return this.findOne(id);
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
    return this.findOne(id);
  }

  /** Triaje manual por enfermería (hasta que el wearable lo actualice en la Fase 2). */
  async updateTriage(id: string, triageLevel: TriageLevel): Promise<Ticket> {
    const ticket = await this.getEntity(id);
    if (!OPEN_TICKET_STATUSES.includes(ticket.status)) {
      throw new ConflictException(
        `No se puede cambiar el triaje de un turno ${TICKET_STATUS_LABELS[ticket.status].toLowerCase()}`,
      );
    }
    await this.tickets.update(id, { triageLevel });
    return this.findOne(id);
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
