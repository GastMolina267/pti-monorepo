import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  MQTT_TOPICS,
  vitalsFindings,
  type TelemetryReading,
  type TriageLevel,
  type VitalsAssessment,
} from '@vitalia/contracts';
import { Repository } from 'typeorm';
import type { Env } from '../../config/env.schema';
import { AlertsService } from '../alerts/alerts.service';
import { TelemetryReadingEntity } from '../iomt/entities/telemetry-reading.entity';
import { MqttService } from '../mqtt/mqtt.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TicketsService } from '../tickets/tickets.service';
import { WearablesService, type IngestWearable } from '../wearables/wearables.service';
import { parseDataTopic } from './data-topic';
import { openEnvelope } from './envelope';
import { parseReading } from './reading.schema';
import { SeqDeduper } from './seq-deduper';
import { TelemetryRejection } from './telemetry-rejection';

export type IngestOutcome =
  | { status: 'accepted'; level: TriageLevel; alerts: number }
  | { status: 'duplicate' }
  | { status: 'unknown-wearable'; wearableId: string }
  | { status: 'rejected'; reason: string };

/** Un mismo motivo de descarte se loguea como mucho una vez por ventana (tormentas de basura). */
const WARN_WINDOW_MS = 30_000;
const MAX_CLOCK_SKEW_MS = 5 * 60_000;

/**
 * Ingesta de telemetría (`hospital/+/wearable/+/data`, QoS 1):
 * sobre → AES-256-GCM → zod → `wearableId` = tópico → wearable registrado → dedupe por seq
 * → `vitalsFindings` → **emisión WS** (`telemetry:reading` y, si es crítica, `alert:emergency`)
 * → persistencia en segundo plano (lectura, `last_seen_at`/sala, escalado de triaje).
 * La base nunca demora la alerta (objetivo < 500 ms de punta a punta).
 */
@Injectable()
export class TelemetryService implements OnModuleInit {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly deduper = new SeqDeduper();
  private readonly lastWarned = new Map<string, number>();
  private readonly pending = new Set<Promise<unknown>>();
  private key: Buffer | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly mqtt: MqttService,
    private readonly realtime: RealtimeGateway,
    private readonly wearables: WearablesService,
    private readonly alerts: AlertsService,
    private readonly tickets: TicketsService,
    @InjectRepository(TelemetryReadingEntity) private readonly readings: Repository<TelemetryReadingEntity>,
  ) {}

  onModuleInit(): void {
    const keyHex = this.config.get('TELEMETRY_AES_KEY', { infer: true });
    if (!keyHex) {
      if (this.mqtt.isEnabled()) {
        this.logger.warn('TELEMETRY_AES_KEY sin configurar: las lecturas de los wearables se ignoran');
      }
      return;
    }
    this.key = Buffer.from(keyHex, 'hex');
    this.mqtt.subscribe(MQTT_TOPICS.allWearableData, (topic, payload) => {
      void this.ingest(topic, payload);
    });
  }

  /** `true` si hay clave para descifrar (lo usa el health). */
  isEnabled(): boolean {
    return this.key !== null;
  }

  /** Procesa un mensaje del tópico de datos. Nunca lanza. */
  async ingest(topic: string, payload: Buffer, receivedAt = new Date()): Promise<IngestOutcome> {
    try {
      if (!this.key) throw new TelemetryRejection('sin TELEMETRY_AES_KEY');
      const target = parseDataTopic(topic);
      if (!target) throw new TelemetryRejection('tópico fuera del contrato');

      const { reading, dropped } = parseReading(openEnvelope(payload, this.key));
      // Sin AAD y con clave compartida: un sobre válido reinyectado en el tópico de otra
      // pulsera tiene que descartarse (revisión del PR #3, docs/04-contratos.md).
      if (reading.wearableId !== target.wearableId) {
        throw new TelemetryRejection(`wearableId ${reading.wearableId} ≠ tópico ${target.wearableId}`);
      }

      const wearable = await this.wearables.findForIngest(reading.wearableId);
      if (!wearable) {
        this.warnOnce(
          `unknown:${reading.wearableId}`,
          `Lectura de ${reading.wearableId}, que no está dada de alta: se descarta`,
        );
        return { status: 'unknown-wearable', wearableId: reading.wearableId };
      }
      if (this.deduper.isDuplicate(wearable.id, reading.seq)) return { status: 'duplicate' };

      if (Math.abs(receivedAt.getTime() - reading.ts) > MAX_CLOCK_SKEW_MS) {
        this.warnOnce(`skew:${wearable.code}`, `${wearable.code}: el reloj difiere más de 5 min (¿NTP?)`);
      }
      for (const field of dropped) {
        this.warnOnce(
          `range:${wearable.code}:${field}`,
          `${wearable.code}: ${field} fuera de rango, se descarta solo ese campo`,
        );
      }

      const findings = vitalsFindings(reading);
      const assessment: VitalsAssessment = {
        level: findings[0]?.level ?? 'STABLE',
        reasons: findings.map((f) => f.reason),
      };

      // Camino crítico: emitir antes de tocar la base.
      this.realtime.emitTelemetryReading({
        wearableId: wearable.code,
        ticketId: wearable.ticketId,
        ticketCode: wearable.ticketCode,
        reading,
        assessment,
        receivedAt: receivedAt.toISOString(),
      });
      const critical = findings.filter((f) => f.level === 'CRITICAL');
      const alertsSaved = this.alerts.raise(
        {
          wearableId: wearable.id,
          wearableCode: wearable.code,
          ticketId: wearable.ticketId,
          ticketCode: wearable.ticketCode,
          patientId: wearable.patientId,
        },
        critical,
        new Date(reading.ts),
      );

      this.track(
        Promise.all([
          alertsSaved,
          this.persist(wearable, reading, target.room, assessment.level, receivedAt),
        ]),
      );
      return { status: 'accepted', level: assessment.level, alerts: critical.length };
    } catch (err) {
      if (!(err instanceof TelemetryRejection)) {
        this.logger.error(`Error inesperado procesando ${topic}: ${(err as Error).message}`);
        return { status: 'rejected', reason: 'error interno' };
      }
      this.warnOnce(`rejected:${topic}:${err.reason}`, `Mensaje descartado en ${topic}: ${err.reason}`);
      return { status: 'rejected', reason: err.reason };
    }
  }

  /** Espera la persistencia en curso (tests y apagado ordenado). */
  async idle(): Promise<void> {
    while (this.pending.size > 0) await Promise.allSettled([...this.pending]);
  }

  private async persist(
    wearable: IngestWearable,
    r: TelemetryReading,
    room: string,
    level: TriageLevel,
    receivedAt: Date,
  ): Promise<void> {
    try {
      await this.readings
        .createQueryBuilder()
        .insert()
        .into(TelemetryReadingEntity)
        .values({
          wearableId: wearable.id,
          ticketId: wearable.ticketId,
          seq: r.seq,
          measuredAt: new Date(r.ts),
          receivedAt,
          heartRate: r.hr === undefined ? null : Math.round(r.hr),
          spo2: r.spo2 === undefined ? null : Math.round(r.spo2),
          temperature: r.temp === undefined ? null : r.temp.toFixed(1),
          accPeakG: r.accPeakG === undefined ? null : r.accPeakG.toFixed(2),
          fall: r.fall ?? false,
          triageLevel: level,
        })
        // Respaldo de la dedupe en memoria (p. ej., reenvíos después de reiniciar la API).
        .orIgnore()
        .execute();
      await this.wearables.touch(wearable.id, receivedAt, room);
      if (wearable.ticketId && level !== 'STABLE')
        await this.tickets.escalateTriage(wearable.ticketId, level);
    } catch (err) {
      this.logger.error(`No se pudo guardar la lectura de ${wearable.code}: ${(err as Error).message}`);
    }
  }

  private track(p: Promise<unknown>): void {
    this.pending.add(p);
    void p.finally(() => this.pending.delete(p));
  }

  private warnOnce(key: string, message: string): void {
    const now = Date.now();
    if (now - (this.lastWarned.get(key) ?? 0) < WARN_WINDOW_MS) return;
    this.lastWarned.set(key, now);
    if (this.lastWarned.size > 1000) this.lastWarned.clear();
    this.logger.warn(message);
  }
}
