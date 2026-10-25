import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Env } from '../../config/env.schema';

const BATCH = 5000;
/** Primera limpieza un rato después de arrancar, para no competir con las migraciones y el seed. */
const FIRST_RUN_DELAY_MS = 30_000;

/**
 * Borra las lecturas de telemetría más viejas que `TELEMETRY_RETENTION_HOURS` (0 = nunca).
 * Con 50 pulseras cada 3 s son ~1,4 M de filas por día: sin esto la base crece sin límite
 * durante la operación de 24 h+. Borra por lotes (índice `ix_readings_measured_at`) para no
 * bloquear la ingesta. Las alertas y los turnos no se tocan.
 */
@Injectable()
export class TelemetryRetentionService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryRetentionService.name);
  private timers: ReturnType<typeof setTimeout>[] = [];
  private running = false;

  constructor(
    private readonly config: ConfigService<Env, true>,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  onApplicationBootstrap(): void {
    const hours = this.config.get('TELEMETRY_RETENTION_HOURS', { infer: true });
    if (!hours) {
      this.logger.log('Retención de telemetría deshabilitada (TELEMETRY_RETENTION_HOURS=0)');
      return;
    }
    const everyMs = this.config.get('TELEMETRY_RETENTION_INTERVAL_MINUTES', { infer: true }) * 60_000;
    const first = setTimeout(() => void this.purge(), FIRST_RUN_DELAY_MS);
    const periodic = setInterval(() => void this.purge(), everyMs);
    first.unref?.();
    periodic.unref?.();
    this.timers = [first, periodic];
    this.logger.log(`Retención de telemetría: ${hours} h (limpieza cada ${everyMs / 60_000} min)`);
  }

  onModuleDestroy(): void {
    for (const t of this.timers) clearTimeout(t);
  }

  /** Borra lo vencido y devuelve cuántas lecturas eliminó. Nunca lanza. */
  async purge(now = new Date()): Promise<number> {
    const hours = this.config.get('TELEMETRY_RETENTION_HOURS', { infer: true });
    if (!hours || this.running) return 0;
    this.running = true;
    const cutoff = new Date(now.getTime() - hours * 3_600_000);
    let total = 0;
    try {
      for (;;) {
        // En PostgreSQL, TypeORM devuelve [filas, cantidad] para DELETE/UPDATE.
        const [, deleted] = (await this.db.query(
          `DELETE FROM telemetry_readings
            WHERE id IN (SELECT id FROM telemetry_readings WHERE measured_at < $1 LIMIT ${BATCH})`,
          [cutoff],
        )) as [unknown[], number];
        total += deleted;
        if (deleted < BATCH) break;
      }
      if (total) this.logger.log(`Se borraron ${total} lecturas anteriores a ${cutoff.toISOString()}`);
    } catch (err) {
      this.logger.error(`No se pudo limpiar la telemetría: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
    return total;
  }
}
