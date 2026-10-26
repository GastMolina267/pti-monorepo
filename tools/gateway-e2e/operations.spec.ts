import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { type ConsultingRoom, type Ticket } from '@vitalia/contracts';
import { gatewayComposeInvocation } from '../scripts/gateway-compose.mjs';
import { createBackup, checkBackup } from '../scripts/gateway-backup.mjs';
import { GatewayApi, login, TestWearable, tvOrigin } from './support';
import { FixtureJournal } from '../scripts/gateway-fixtures';
import { recoverRun } from '../scripts/gateway-recover';

async function compose(args: string[]): Promise<void> {
  const invocation = gatewayComposeInvocation(args);
  await new Promise<void>((resolve, reject) => {
    const child = spawn('docker', invocation.args, {
      env: invocation.env,
      stdio: 'ignore',
      timeout: 200_000,
    });
    child.once('error', () => reject(new Error('No se pudo ejecutar Docker')));
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Compose falló; revisá el estado del gateway')),
    );
  });
}

test('operación: persistencia, reconexión tras reinicios y restauración aislada', async ({
  browser,
  playwright,
}) => {
  const staff = await browser.newContext();
  const tvContext = await browser.newContext();
  const page = await staff.newPage();
  const tv = await tvContext.newPage();
  let api: GatewayApi | undefined;
  let device: TestWearable | undefined;
  let stopped = false;
  try {
    const session = await login(page);
    api = new GatewayApi(
      await playwright.request.newContext({
        timeout: 10_000,
        extraHTTPHeaders: { Authorization: `Bearer ${session.accessToken}` },
      }),
    );
    const gateway = api;
    device = await TestWearable.available(gateway);
    const wearable = device;
    await device.connect();
    await tv.goto(tvOrigin);
    await expect(tv.getByRole('status')).toHaveText('En vivo');
    const ticket = await gateway.checkIn('persistencia y recuperación');
    await gateway.call('POST', `/wearables/${device.wearable.id}/assign`, { ticketId: ticket.id });
    const seq = await device.publish({ hr: 81 });
    await expect.poll(async () => (await gateway.wearable(wearable.wearable.id)).lastReading?.seq).toBe(seq);
    const configuration = ['.gateway/.env', '.gateway/mqtt/devices.json'].map((f) => readFileSync(f));
    const navigations: string[] = [];
    page.on('framenavigated', (f) => {
      if (f === page.mainFrame()) navigations.push(f.url());
    });
    tv.on('framenavigated', (f) => {
      if (f === tv.mainFrame()) navigations.push(f.url());
    });

    await test.step('Apagar/recrear sin borrar volúmenes: conservar turno, lectura, asignación y credenciales', async () => {
      await wearable.close();
      stopped = true;
      await compose(['down']);
      await expect(page.locator('header.topbar .conn')).toHaveText('Reconectando…');
      await compose(['up', '--force-recreate', '-d', '--wait', '--wait-timeout', '180']);
      stopped = false;
      for (const [i, file] of ['.gateway/.env', '.gateway/mqtt/devices.json'].entries())
        expect(readFileSync(file).equals(configuration[i]), 'Credenciales conservadas').toBe(true);
      expect((await gateway.call<Ticket>('GET', `/tickets/${ticket.id}`)).id).toBe(ticket.id);
      const persisted = await gateway.wearable(wearable.wearable.id);
      expect(persisted.ticket?.id).toBe(ticket.id);
      expect(persisted.lastReading?.seq).toBe(seq);
      await expect(page.locator('header.topbar .conn')).toHaveText('En vivo', { timeout: 30_000 });
      await expect(tv.getByRole('status')).toHaveText('En vivo', { timeout: 30_000 });
    });
    await test.step('Reiniciar broker: API se resuscribe, ingiere una alerta nueva y vuelve a emitir comandos', async () => {
      await compose(['restart', 'mosquitto']);
      await expect
        .poll(
          async () => {
            try {
              return (await gateway.call<{ status: string }>('GET', '/health')).status;
            } catch {
              return 'down';
            }
          },
          { timeout: 40_000 },
        )
        .toBe('ok');
      await wearable.connect();
      const next = await wearable.publish({ hr: 82, fall: true, accPeakG: 3.2 });
      await gateway.alert(ticket.id, 'FALL');
      await expect
        .poll(async () => (await gateway.wearable(wearable.wearable.id)).lastReading?.seq)
        .toBe(next);
      await expect(page.getByRole('alertdialog').locator('h2')).toContainText(ticket.code);
      const room = (await gateway.call<ConsultingRoom[]>('GET', '/consulting-rooms'))[0];
      await gateway.call('POST', `/tickets/${ticket.id}/call`, { consultingRoomId: room.id });
      await expect(tv.locator('.call .code')).toHaveText(ticket.code);
      await expect
        .poll(() =>
          wearable.commands.some((c) => c.value.type === 'SHOW_TICKET' && c.value.ticketCode === ticket.code),
        )
        .toBe(true);
      expect(navigations).toEqual([]);
    });
    await wearable.close();
    await gateway.cleanup();
    await test.step('Recuperar check-in interrumpido sin ID guardado y repetir limpieza sin alterar otros turnos', async () => {
      const before = await gateway.call<Ticket[]>('GET', '/tickets');
      const interrupted = await gateway.checkIn('respuesta HTTP perdida');
      const owned = await gateway.call<Ticket>('GET', `/tickets/${interrupted.id}`);
      const id = owned.reason!.split(': ')[1];
      const journal = new FixtureJournal(id, '.gateway/runs', true);
      journal.run.tickets = journal.run.tickets.filter((t) => t !== interrupted.id);
      delete journal.run.cleanedAt;
      journal.save();
      await recoverRun(id);
      await recoverRun(id);
      expect((await gateway.call<Ticket>('GET', `/tickets/${interrupted.id}`)).status).toBe('CANCELLED');
      expect((await gateway.call<Ticket[]>('GET', '/tickets')).map((t) => [t.id, t.status])).toEqual(
        before.map((t) => [t.id, t.status]),
      );
    });
    await test.step('Respaldar base/configuración y restaurar en PostgreSQL aislado', async () => {
      const backup = createBackup();
      console.log(`Respaldo operativo: ${backup}`);
      await checkBackup(backup);
      // La base original sigue operativa y conserva el turno finalizado.
      expect((await gateway.call<Ticket>('GET', `/tickets/${ticket.id}`)).status).toBe('DONE');
    });
  } finally {
    if (stopped) await compose(['up', '-d', '--wait', '--wait-timeout', '180']);
    await device?.close();
    try {
      await api?.cleanup();
    } finally {
      await api?.request.dispose();
      await staff.close();
      await tvContext.close();
    }
  }
});
