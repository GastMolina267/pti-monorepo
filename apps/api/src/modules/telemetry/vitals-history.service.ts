import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  TRIAGE_LEVELS,
  VITALS_HISTORY_DEFAULT_MINUTES,
  VITALS_HISTORY_MAX_MINUTES,
  VITALS_HISTORY_MAX_POINTS,
  type VitalsHistory,
  type VitalsPoint,
} from '@vitalia/contracts';
import { DataSource } from 'typeorm';

/** Lecturas cada 3 s: nunca se agrupa por menos que eso. */
const MIN_BUCKET_SECONDS = 3;

/** Segundos por punto para no superar `VITALS_HISTORY_MAX_POINTS` en la ventana. */
export function bucketSecondsFor(minutes: number): number {
  return Math.max(MIN_BUCKET_SECONDS, Math.ceil((minutes * 60) / VITALS_HISTORY_MAX_POINTS));
}

export function clampMinutes(minutes: number | undefined): number {
  if (!minutes || !Number.isFinite(minutes)) return VITALS_HISTORY_DEFAULT_MINUTES;
  return Math.min(VITALS_HISTORY_MAX_MINUTES, Math.max(1, Math.round(minutes)));
}

interface Row {
  at: Date;
  hr: string | null;
  spo2: string | null;
  temp: string | null;
  acc: string | null;
  fall: boolean;
  lvl: number;
  samples: string;
}

const round = (v: string | null, decimals: number) =>
  v === null ? null : Math.round(Number(v) * 10 ** decimals) / 10 ** decimals;

/**
 * Curva de signos vitales de un turno (base de RF-D3). Agrupa en SQL con `date_bin` para que
 * una ventana de 24 h no devuelva 28.800 lecturas: promedios, máximo del pico de aceleración,
 * caída si hubo alguna y el nivel más grave del intervalo.
 */
@Injectable()
export class VitalsHistoryService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async forTicket(ticketId: string, minutesParam?: number, now = new Date()): Promise<VitalsHistory> {
    const [ticket] = await this.db.query('SELECT id FROM tickets WHERE id = $1', [ticketId]);
    if (!ticket) throw new NotFoundException('Turno no encontrado');

    const minutes = clampMinutes(minutesParam);
    const bucketSeconds = bucketSecondsFor(minutes);
    const from = new Date(now.getTime() - minutes * 60_000);

    const [rows, wearable, alerts] = await Promise.all([
      this.db.query(
        `SELECT date_bin(make_interval(secs => $2), measured_at, $3::timestamptz) AS at,
                avg(heart_rate) AS hr, avg(spo2) AS spo2, avg(temperature) AS temp,
                max(acc_peak_g) AS acc, bool_or(fall) AS fall,
                max(CASE triage_level WHEN 'CRITICAL' THEN 2 WHEN 'ATTENTION' THEN 1 ELSE 0 END) AS lvl,
                count(*) AS samples
           FROM telemetry_readings
          WHERE ticket_id = $1 AND measured_at >= $3 AND measured_at <= $4
          GROUP BY 1
          ORDER BY 1`,
        [ticketId, bucketSeconds, from, now],
      ) as Promise<Row[]>,
      this.db.query('SELECT code FROM wearables WHERE ticket_id = $1', [ticketId]) as Promise<
        { code: string }[]
      >,
      this.db.query(
        `SELECT id, kind, status, detected_at FROM alerts
          WHERE ticket_id = $1 AND detected_at >= $2 ORDER BY detected_at`,
        [ticketId, from],
      ) as Promise<
        {
          id: string;
          kind: VitalsHistory['alerts'][number]['kind'];
          status: VitalsHistory['alerts'][number]['status'];
          detected_at: Date;
        }[]
      >,
    ]);

    const points: VitalsPoint[] = rows.map((r) => ({
      at: new Date(r.at).toISOString(),
      hr: round(r.hr, 0),
      spo2: round(r.spo2, 0),
      temp: round(r.temp, 1),
      accPeakG: round(r.acc, 2),
      fall: r.fall,
      level: TRIAGE_LEVELS[Number(r.lvl)] ?? 'STABLE',
      samples: Number(r.samples),
    }));

    return {
      ticketId,
      wearableCode: wearable[0]?.code ?? null,
      from: from.toISOString(),
      to: now.toISOString(),
      bucketSeconds,
      points,
      alerts: alerts.map((a) => ({
        id: a.id,
        kind: a.kind,
        status: a.status,
        detectedAt: new Date(a.detected_at).toISOString(),
      })),
    };
  }
}
