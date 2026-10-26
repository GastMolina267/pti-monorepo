import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  assessVitals,
  type PairingCode,
  type PatientOverview,
  type PatientSession,
  type PatientVitals,
} from '@vitalia/contracts';
import { Repository } from 'typeorm';
import { TelemetryReadingEntity } from '../iomt/entities/telemetry-reading.entity';
import { WearableEntity } from '../iomt/entities/wearable.entity';
import { displayName } from '../tickets/tickets.mapper';
import { TicketsService } from '../tickets/tickets.service';
import { PairingService } from './pairing.service';
import { PatientSessionService, type PatientPrincipal } from './patient-session.service';

const num = (v: string | null) => (v === null ? null : Number(v));

/** Lo que ve el paciente de su turno en la app (ADR 0019). Nunca el DNI. */
@Injectable()
export class PatientService {
  constructor(
    private readonly tickets: TicketsService,
    private readonly sessions: PatientSessionService,
    private readonly pairing: PairingService,
    @InjectRepository(TelemetryReadingEntity) private readonly readings: Repository<TelemetryReadingEntity>,
    @InjectRepository(WearableEntity) private readonly wearables: Repository<WearableEntity>,
  ) {}

  /** El personal genera un código para que el paciente vincule la app a un turno existente. */
  async createPairing(ticketId: string): Promise<PairingCode> {
    const { ticket } = await this.tickets.getForPatient(ticketId);
    const { code, expiresAt } = this.pairing.create(ticket.id);
    return { code, expiresAt: expiresAt.toISOString(), ticketCode: ticket.code };
  }

  async pair(code: string): Promise<PatientSession> {
    const ticketId = this.pairing.redeem(code);
    const { ticket, patient } = await this.tickets.getForPatient(ticketId);
    return this.sessions.issue(ticket.id, patient.id);
  }

  async overview(principal: PatientPrincipal, now = new Date()): Promise<PatientOverview> {
    const { ticket, patient } = await this.tickets.getForPatient(principal.ticketId);
    // Defensa extra: el token es de este paciente (no debería fallar nunca).
    if (patient.id !== principal.patientId) throw new NotFoundException('Turno no encontrado');
    return {
      patient: { firstName: patient.firstName, displayName: displayName(patient) },
      ticket,
      vitals: await this.lastVitals(ticket.id),
      serverTime: now.toISOString(),
    };
  }

  private async lastVitals(ticketId: string): Promise<PatientVitals | null> {
    const reading = await this.readings.findOne({
      where: { ticketId },
      order: { measuredAt: 'DESC' },
      relations: { wearable: true },
    });
    if (!reading) return null;
    const assigned = await this.wearables.findOneBy({ ticketId });
    const hr = reading.heartRate;
    const spo2 = reading.spo2;
    const temp = num(reading.temperature);
    const assessment = assessVitals({
      ...(hr === null ? {} : { hr }),
      ...(spo2 === null ? {} : { spo2 }),
      ...(temp === null ? {} : { temp }),
      fall: reading.fall,
    });
    return {
      wearableCode: assigned?.code ?? reading.wearable.code,
      measuredAt: reading.measuredAt.toISOString(),
      hr,
      spo2,
      temp,
      fall: reading.fall,
      level: assessment.level,
      reasons: assessment.reasons,
    };
  }
}
