import { ConflictException, Injectable, Logger, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Alert, AlertEmergencyEvent, AlertKind, VitalsFinding } from '@vitalia/contracts';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import type { AuthUser } from '../../common/auth/auth-user';
import { AlertEntity } from '../iomt/entities/alert.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SyncService } from '../sync/sync.service';
import { toAlert } from './alerts.mapper';

const RELATIONS = { wearable: true, ticket: { patient: true }, acknowledgedBy: true } as const;
const MAX_LISTED = 100;

/** A quién pertenece la lectura que disparó la alerta. */
export interface AlertSource {
  /** `wearables.id` (uuid). */
  wearableId: string;
  /** `wearables.code` (`wb-<NN>-<mac>`). */
  wearableCode: string;
  ticketId: string | null;
  ticketCode: string | null;
  patientId: string | null;
}

const key = (wearableId: string, kind: AlertKind) => `${wearableId}:${kind}`;

@Injectable()
export class AlertsService implements OnModuleInit {
  private readonly logger = new Logger(AlertsService.name);
  /**
   * Alertas ACTIVAS por `wearable:kind`, en memoria para decidir sin ir a la base si una
   * lectura crítica abre una alerta nueva. Este service es el único que crea o reconoce
   * alertas, y el gateway corre en una sola instancia (Edge), así que se mantiene al día.
   */
  private readonly active = new Set<string>();

  constructor(
    @InjectRepository(AlertEntity) private readonly alerts: Repository<AlertEntity>,
    private readonly realtime: RealtimeGateway,
    private readonly sync: SyncService,
  ) {}

  async onModuleInit(): Promise<void> {
    const rows = await this.alerts.find({
      select: { wearableId: true, kind: true },
      where: { status: 'ACTIVE' },
    });
    for (const r of rows) this.active.add(key(r.wearableId, r.kind));
  }

  /**
   * Abre una alerta por cada hallazgo CRÍTICO que no tenga ya una alerta activa del mismo tipo
   * en ese wearable (sin tormenta de alertas: una caída se avisa una vez hasta que alguien la
   * reconoce). `alert:emergency` se emite **antes** de escribir en la base: la persistencia
   * nunca demora la alerta. Devuelve la promesa de la persistencia (no lanza).
   */
  raise(source: AlertSource, findings: VitalsFinding[], detectedAt: Date): Promise<void> {
    const created: AlertEntity[] = [];
    for (const f of findings) {
      if (f.level !== 'CRITICAL' || this.active.has(key(source.wearableId, f.kind))) continue;
      this.active.add(key(source.wearableId, f.kind));

      const id = randomUUID();
      const event: AlertEmergencyEvent = {
        alertId: id,
        wearableId: source.wearableCode,
        kind: f.kind,
        level: f.level,
        message: f.reason,
        detectedAt: detectedAt.toISOString(),
        ...(source.ticketId ? { ticketId: source.ticketId } : {}),
        ...(source.ticketCode ? { ticketCode: source.ticketCode } : {}),
        ...(source.patientId ? { patientId: source.patientId } : {}),
      };
      this.realtime.emitAlertEmergency(event);
      created.push(
        this.alerts.create({
          id,
          kind: f.kind,
          level: f.level,
          status: 'ACTIVE',
          message: f.reason.slice(0, 200),
          wearableId: source.wearableId,
          ticketId: source.ticketId,
          detectedAt,
        }),
      );
    }
    if (created.length === 0) return Promise.resolve();
    return this.alerts
      .insert(created)
      .then(() => {
        for (const a of created) this.sync.enqueue('alert.upsert', a.id, this.toSyncAlert(a, source));
      })
      .catch((err: Error) => {
        for (const a of created) this.active.delete(key(a.wearableId, a.kind));
        this.logger.error(`No se pudieron guardar ${created.length} alerta(s): ${err.message}`);
      });
  }

  async list(active = true): Promise<Alert[]> {
    const rows = await this.alerts.find({
      where: active ? { status: 'ACTIVE' } : {},
      relations: RELATIONS,
      order: { detectedAt: 'DESC' },
      take: MAX_LISTED,
    });
    return rows.map(toAlert);
  }

  async acknowledge(id: string, user: AuthUser): Promise<Alert> {
    const alert = await this.alerts.findOneBy({ id });
    if (!alert) throw new NotFoundException('Alerta no encontrada');
    if (alert.status !== 'ACTIVE') throw new ConflictException('La alerta ya fue reconocida');

    const at = new Date();
    await this.alerts.update(id, { status: 'ACKNOWLEDGED', acknowledgedAt: at, acknowledgedById: user.id });
    this.active.delete(key(alert.wearableId, alert.kind));
    this.realtime.emitAlertAcknowledged({
      alertId: id,
      by: { id: user.id, fullName: user.fullName },
      at: at.toISOString(),
    });
    const acknowledged = toAlert(await this.alerts.findOneOrFail({ where: { id }, relations: RELATIONS }));
    this.sync.enqueue('alert.upsert', id, acknowledged);
    return acknowledged;
  }

  /** Forma de `Alert` para la nube sin volver a consultar la base en el camino de la ingesta. */
  private toSyncAlert(a: AlertEntity, source: AlertSource): Alert {
    return {
      id: a.id,
      kind: a.kind,
      level: a.level,
      status: a.status,
      message: a.message,
      wearableId: source.wearableCode,
      ticketId: a.ticketId,
      ticketCode: source.ticketCode,
      patientDisplayName: null,
      detectedAt: a.detectedAt.toISOString(),
      acknowledgedAt: null,
      acknowledgedBy: null,
    };
  }
}
