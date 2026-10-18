import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { type Alert, type Ticket } from '@vitalia/contracts';
import { cleanupFixtures, FixtureJournal, runMarker, type ApiCall } from './gateway-fixtures';

test('recupera una corrida interrumpida, reconoce solo sus alertas y es idempotente', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vitalia-fixtures-'));
  try {
    const journal = new FixtureJournal(randomUUID(), directory);
    const tickets = new Map(
      Array.from(['WAITING', 'CALLED', 'IN_PROGRESS', 'DONE'] as const, (status) => {
        const id = randomUUID();
        return [id, { id, status, reason: `${runMarker(journal.run.id)} prueba` } as Ticket];
      }),
    );
    const [first, missing] = [...tickets.keys()];
    journal.remember(first);
    const other = randomUUID();
    const alerts = [
      { id: 'owned', ticketId: missing },
      { id: 'other', ticketId: other },
    ] as Alert[];
    const mutations: string[] = [];
    const call: ApiCall = async <T>(method: string, path: string, data?: unknown): Promise<T> => {
      if (path === '/alerts') return alerts as T;
      if (method === 'POST') {
        mutations.push(path);
        alerts.splice(
          alerts.findIndex((a) => path.includes(a.id)),
          1,
        );
        return {} as T;
      }
      const ticket = tickets.get(path.split('/')[2])!;
      if (method === 'PATCH') {
        mutations.push(path);
        ticket.status = (data as Ticket).status;
      }
      return { ...ticket } as T;
    };
    const resumed = new FixtureJournal(journal.run.id, directory, true);
    await cleanupFixtures(resumed, call, [...tickets.keys()]);
    assert.deepEqual(
      [...tickets.values()].map((t) => t.status),
      ['CANCELLED', 'DONE', 'DONE', 'DONE'],
    );
    assert.deepEqual(
      alerts.map((a) => a.id),
      ['other'],
    );
    const count = mutations.length;
    await cleanupFixtures(resumed, call);
    assert.equal(mutations.length, count);
    assert.ok(new FixtureJournal(journal.run.id, directory, true).run.cleanedAt);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rechaza IDs externos y turnos ajenos antes de hacer cualquier mutación', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vitalia-fixtures-'));
  try {
    assert.throws(() => new FixtureJournal('../outside', directory));
    const journal = new FixtureJournal(randomUUID(), directory);
    journal.remember(randomUUID());
    let mutations = 0;
    const call: ApiCall = async <T>(method: string): Promise<T> => {
      if (method !== 'GET') mutations++;
      return { reason: 'Turno del seed', status: 'WAITING' } as T;
    };
    await assert.rejects(cleanupFixtures(journal, call), /no pertenece/);
    assert.equal(mutations, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
