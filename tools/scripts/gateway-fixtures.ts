import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OPEN_TICKET_STATUSES, type Alert, type Ticket } from '@vitalia/contracts';

export const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export interface FixtureRun {
  id: string;
  startedAt: string;
  tickets: string[];
  cleanedAt?: string;
}
export type ApiCall = <T>(method: string, path: string, data?: unknown) => Promise<T>;

export function runMarker(id: string): string {
  if (!RUN_ID.test(id)) throw new Error('Identificador de corrida inválido');
  return `E2E simulado 4e: ${id}:`;
}

/** Diario local sin credenciales. Se escribe antes del primer check-in. */
export class FixtureJournal {
  readonly run: FixtureRun;
  readonly file: string;
  constructor(id: string = randomUUID(), directory = '.gateway/runs', existing = false) {
    runMarker(id);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.file = resolve(directory, `${id}.json`);
    this.run = existing
      ? JSON.parse(readFileSync(this.file, 'utf8'))
      : { id, startedAt: new Date().toISOString(), tickets: [] };
    if (
      this.run.id !== id ||
      !Array.isArray(this.run.tickets) ||
      !this.run.tickets.every((t) => RUN_ID.test(t))
    )
      throw new Error('Diario de corrida inválido');
    if (!existing) this.save();
  }
  save(): void {
    writeFileSync(`${this.file}.tmp`, JSON.stringify(this.run, null, 2) + '\n', { mode: 0o600 });
    renameSync(`${this.file}.tmp`, this.file);
  }
  remember(id: string): void {
    if (!RUN_ID.test(id)) throw new Error('ID de turno inválido');
    if (!this.run.tickets.includes(id)) this.run.tickets.push(id);
    this.save();
  }
}

/** Comprueba el marcador aun si el diario fue editado. Nunca borra registros. */
export async function cleanupFixtures(
  journal: FixtureJournal,
  call: ApiCall,
  discovered: string[] = [],
): Promise<void> {
  const ids = [...new Set([...journal.run.tickets, ...discovered])];
  const tickets: Ticket[] = [];
  for (const id of ids) {
    if (!RUN_ID.test(id)) throw new Error('ID de turno inválido');
    const ticket = await call<Ticket>('GET', `/tickets/${id}`);
    if (!ticket.reason?.startsWith(runMarker(journal.run.id)))
      throw new Error('El turno no pertenece a esta corrida; se cancela la limpieza');
    tickets.push(ticket);
  }
  const owned = new Set(ids);
  for (const alert of await call<Alert[]>('GET', '/alerts')) {
    if (alert.ticketId && owned.has(alert.ticketId)) await call('POST', `/alerts/${alert.id}/ack`, {});
  }
  for (let ticket of tickets) {
    if (ticket.status === 'CALLED')
      ticket = await call('PATCH', `/tickets/${ticket.id}/status`, { status: 'IN_PROGRESS' });
    if (OPEN_TICKET_STATUSES.includes(ticket.status))
      await call('PATCH', `/tickets/${ticket.id}/status`, {
        status: ticket.status === 'IN_PROGRESS' ? 'DONE' : 'CANCELLED',
      });
    journal.remember(ticket.id);
  }
  journal.run.cleanedAt = new Date().toISOString();
  journal.save();
}
