import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { Env } from '../../config/env.schema';
import type { SyncOutboxEntity } from './entities/sync-outbox.entity';
import { SyncService } from './sync.service';

const row = (id: number): SyncOutboxEntity => ({
  id: String(id),
  topic: 'ticket.upsert',
  entityId: `t${id}`,
  payload: { code: `A-00${id}` },
  occurredAt: new Date('2026-10-25T12:00:00Z'),
  sentAt: null,
  attempts: 0,
});

function setup(url: string | undefined = 'http://nube.test/ingest', pending = [row(1), row(2)]) {
  let queue = [...pending];
  const repo = {
    insert: jest.fn().mockResolvedValue({}),
    find: jest.fn(async () => queue.splice(0, 100)),
    update: jest.fn().mockResolvedValue({}),
    increment: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    countBy: jest.fn(async () => queue.length),
  };
  const env: Record<string, unknown> = {
    CLOUD_SYNC_URL: url,
    CLOUD_SYNC_TOKEN: 'secreto',
    GATEWAY_ID: 'gw-test',
    CLOUD_SYNC_INTERVAL_SECONDS: 15,
  };
  const service = new SyncService(
    repo as unknown as Repository<SyncOutboxEntity>,
    { get: (k: string) => env[k] } as unknown as ConfigService<Env, true>,
  );
  return { service, repo, reset: (rows: SyncOutboxEntity[]) => (queue = rows) };
}

describe('SyncService', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('deshabilitado sin CLOUD_SYNC_URL: no guarda nada', async () => {
    const { service, repo } = setup('');
    service.enqueue('ticket.upsert', 't1', {});
    expect(repo.insert).not.toHaveBeenCalled();
    expect((await service.status()).enabled).toBe(false);
  });

  it('envía los pendientes como lote con el token y los marca enviados', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { service, repo } = setup();

    await expect(service.flush()).resolves.toBe(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://nube.test/ingest');
    expect(init.headers.authorization).toBe('Bearer secreto');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      gatewayId: 'gw-test',
      events: [{ id: 1, topic: 'ticket.upsert' }, { id: 2 }],
    });
    expect(repo.update).toHaveBeenCalledWith({ id: expect.anything() }, { sentAt: expect.any(Date) });
  });

  it('sin WAN no marca nada como enviado, suma intentos y lanza (el ciclo reintenta)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed')) as unknown as typeof fetch;
    const { service, repo } = setup();
    await expect(service.flush()).rejects.toThrow('fetch failed');
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.increment).toHaveBeenCalledWith({ id: expect.anything() }, 'attempts', 1);
  });

  it('un HTTP 500 de la nube cuenta como falla', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    const { service } = setup();
    await expect(service.flush()).rejects.toThrow('HTTP 500');
  });
});
