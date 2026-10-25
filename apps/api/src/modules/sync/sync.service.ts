import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { SYNC_BATCH_SIZE, type SyncBatch, type SyncStatus, type SyncTopic } from '@vitalia/contracts';
import { In, IsNull, LessThan, Repository } from 'typeorm';
import type { Env } from '../../config/env.schema';
import { SyncOutboxEntity } from './entities/sync-outbox.entity';

const MAX_BACKOFF_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
const KEEP_SENT_MS = 7 * 24 * 3_600_000;

/**
 * Réplica a la nube (RF-O6). Los services de dominio llaman a `enqueue()` (nunca lanza y no
 * espera red): el cambio queda en `sync_outbox` en PostgreSQL. Un ciclo en segundo plano envía
 * lotes a `CLOUD_SYNC_URL`; sin WAN, reintenta con espera creciente (hasta 5 min) y no se pierde
 * nada. Sin `CLOUD_SYNC_URL`, está deshabilitado y no guarda nada.
 */
@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private flushing: Promise<number> | null = null;
  private consecutiveFailures = 0;
  private lastSuccessAt: Date | null = null;
  private lastError: string | null = null;
  private nextAttemptAt: Date | null = null;

  constructor(
    @InjectRepository(SyncOutboxEntity) private readonly outbox: Repository<SyncOutboxEntity>,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.get('CLOUD_SYNC_URL', { infer: true }));
  }

  onModuleInit(): void {
    if (this.enabled) {
      this.logger.log(`Réplica a la nube activa (${this.config.get('GATEWAY_ID', { infer: true })})`);
      this.schedule(1000);
    }
  }

  onModuleDestroy(): void {
    clearTimeout(this.timer);
  }

  /** Guarda un cambio para replicar. Fire-and-forget: nunca demora ni rompe la operación. */
  enqueue(topic: SyncTopic, entityId: string, payload: unknown): void {
    if (!this.enabled) return;
    this.outbox
      .insert({ topic, entityId, payload: payload as object })
      .catch((err: Error) => this.logger.error(`No se pudo guardar el cambio para la nube: ${err.message}`));
  }

  /** Envía todo lo pendiente por lotes. Lanza si la nube no responde (lo maneja el ciclo). */
  flush(): Promise<number> {
    this.flushing ??= this.sendPending().finally(() => (this.flushing = null));
    return this.flushing;
  }

  async status(): Promise<SyncStatus> {
    return {
      enabled: this.enabled,
      gatewayId: this.config.get('GATEWAY_ID', { infer: true }),
      pending: this.enabled ? await this.outbox.countBy({ sentAt: IsNull() }) : 0,
      lastSuccessAt: this.lastSuccessAt?.toISOString() ?? null,
      lastError: this.lastError,
      consecutiveFailures: this.consecutiveFailures,
      nextAttemptAt: this.nextAttemptAt?.toISOString() ?? null,
    };
  }

  private schedule(ms: number): void {
    clearTimeout(this.timer);
    this.nextAttemptAt = new Date(Date.now() + ms);
    this.timer = setTimeout(() => void this.tick(), ms);
    this.timer.unref?.();
  }

  private async tick(): Promise<void> {
    const interval = this.config.get('CLOUD_SYNC_INTERVAL_SECONDS', { infer: true }) * 1000;
    try {
      await this.flush();
      if (this.consecutiveFailures) this.logger.log('La nube volvió a responder: réplica al día');
      this.consecutiveFailures = 0;
      this.lastError = null;
      this.schedule(interval);
    } catch (err) {
      this.consecutiveFailures++;
      this.lastError = (err as Error).message;
      const wait = Math.min(MAX_BACKOFF_MS, interval * 2 ** this.consecutiveFailures);
      if (this.consecutiveFailures === 1) {
        this.logger.warn(`Sin conexión con la nube (${this.lastError}): los cambios quedan en el outbox`);
      }
      this.schedule(wait);
    }
  }

  private async sendPending(): Promise<number> {
    let sent = 0;
    for (;;) {
      const rows = await this.outbox.find({
        where: { sentAt: IsNull() },
        order: { id: 'ASC' },
        take: SYNC_BATCH_SIZE,
      });
      if (rows.length === 0) break;
      await this.post({
        gatewayId: this.config.get('GATEWAY_ID', { infer: true }),
        sentAt: new Date().toISOString(),
        events: rows.map((r) => ({
          id: Number(r.id),
          topic: r.topic,
          entityId: r.entityId,
          occurredAt: r.occurredAt.toISOString(),
          payload: r.payload,
        })),
      }).catch(async (err: Error) => {
        await this.outbox.increment({ id: In(rows.map((r) => r.id)) }, 'attempts', 1);
        throw err;
      });
      await this.outbox.update({ id: In(rows.map((r) => r.id)) }, { sentAt: new Date() });
      sent += rows.length;
      this.lastSuccessAt = new Date();
      if (rows.length < SYNC_BATCH_SIZE) break;
    }
    await this.outbox.delete({ sentAt: LessThan(new Date(Date.now() - KEEP_SENT_MS)) });
    return sent;
  }

  private async post(batch: SyncBatch): Promise<void> {
    const token = this.config.get('CLOUD_SYNC_TOKEN', { infer: true });
    const res = await fetch(this.config.get('CLOUD_SYNC_URL', { infer: true }) as string, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`la nube respondió HTTP ${res.status}`);
  }
}
