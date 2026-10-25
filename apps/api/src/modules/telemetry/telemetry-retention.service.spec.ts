import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import type { Env } from '../../config/env.schema';
import { TelemetryRetentionService } from './telemetry-retention.service';
import { bucketSecondsFor, clampMinutes } from './vitals-history.service';

function setup(hours: number, batches: number[]) {
  const query = jest.fn();
  // Forma real de TypeORM + pg para un DELETE: [filas, cantidad].
  for (const n of batches) query.mockResolvedValueOnce([[], n]);
  const service = new TelemetryRetentionService(
    {
      get: (k: string) => ({ TELEMETRY_RETENTION_HOURS: hours, TELEMETRY_RETENTION_INTERVAL_MINUTES: 60 })[k],
    } as unknown as ConfigService<Env, true>,
    { query } as unknown as DataSource,
  );
  return { service, query };
}

describe('TelemetryRetentionService', () => {
  it('borra por lotes hasta que no quedan lecturas vencidas', async () => {
    const { service, query } = setup(72, [5000, 5000, 120]);
    const now = new Date('2026-10-25T12:00:00Z');
    await expect(service.purge(now)).resolves.toBe(10_120);
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[0][1]).toEqual([new Date('2026-10-22T12:00:00Z')]);
  });

  it('con TELEMETRY_RETENTION_HOURS=0 no borra nada', async () => {
    const { service, query } = setup(0, []);
    await expect(service.purge()).resolves.toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('un error de la base no rompe (devuelve lo borrado hasta ahí)', async () => {
    const { service, query } = setup(1, [5000]);
    query.mockRejectedValueOnce(new Error('db caída'));
    await expect(service.purge()).resolves.toBe(5000);
  });
});

describe('curva de signos vitales', () => {
  it('agrupa para no pasar de 600 puntos y nunca por menos de 3 s', () => {
    expect(bucketSecondsFor(10)).toBe(3);
    expect(bucketSecondsFor(120)).toBe(12);
    expect(bucketSecondsFor(24 * 60)).toBe(144);
  });

  it('acota la ventana entre 1 min y 24 h (por defecto 2 h)', () => {
    expect(clampMinutes(undefined)).toBe(120);
    expect(clampMinutes(99_999)).toBe(1440);
    expect(clampMinutes(0)).toBe(120);
    expect(clampMinutes(0.2)).toBe(1);
  });
});
