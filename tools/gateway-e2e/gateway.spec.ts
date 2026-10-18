import { test, expect } from '@playwright/test';
import {
  MQTT_TOPICS,
  type Alert,
  type CheckInResponse,
  type ConsultingRoom,
  type LoginResponse,
  type Ticket,
} from '@vitalia/contracts';
import { GatewayApi, login, networkGate, TestWearable, tvOrigin } from './support';
import { setTimeout as delay } from 'node:timers/promises';

async function checkpoint(message: string): Promise<void> {
  if (process.env['GATEWAY_DEMO'] !== '1') return;
  console.log(`DEMO · ${message}`);
  await delay(5000);
}

test('gateway: recorrido clínico y resincronización de Backoffice/TV sin recargar', async ({
  browser,
  playwright,
}) => {
  const staff = await browser.newContext();
  const tvContext = await browser.newContext();
  const offlineStaff = await networkGate(staff);
  const offlineTv = await networkGate(tvContext);
  const page = await staff.newPage();
  const tv = await tvContext.newPage();
  let api: GatewayApi | undefined;
  let wearable: TestWearable | undefined;
  let first: CheckInResponse;
  let second: CheckInResponse;
  let user: LoginResponse['user'];
  try {
    await test.step('Login real y conexiones a través de Nginx', async () => {
      const session = await login(page);
      user = session.user;
      api = new GatewayApi(
        await playwright.request.newContext({
          timeout: 10_000,
          extraHTTPHeaders: { Authorization: `Bearer ${session.accessToken}` },
        }),
      );
      wearable = await TestWearable.available(api);
      await wearable.connect();
      await tv.goto(tvOrigin);
      await expect(tv.getByRole('status')).toHaveText('En vivo');
    });
    const gateway = api!;
    const device = wearable!;
    const deviceId = device.wearable.id;
    const row = (code: string) =>
      page.locator('li.row').filter({ has: page.getByText(code, { exact: true }) });
    const pulse = (code: string) => row(code).locator('[title="Frecuencia cardíaca"]');
    await test.step('Check-in por API y asignación desde Backoffice', async () => {
      first = await gateway.checkIn('recorrido');
      await expect(row(first.code)).toBeVisible();
      await page.getByRole('link', { name: 'Pulseras', exact: true }).click();
      const card = page
        .locator('article.card')
        .filter({ has: page.getByText(device.wearable.code, { exact: true }) });
      await card.getByRole('button', { name: 'Asignar a un turno' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('searchbox').fill(first.code);
      await dialog.getByRole('option').filter({ hasText: first.code }).click();
      await dialog.getByRole('button', { name: 'Asignar', exact: true }).click();
      await expect(dialog).not.toBeVisible();
      expect((await gateway.wearable(deviceId)).ticket?.id).toBe(first.id);
      await page.getByRole('link', { name: 'Triaje', exact: true }).click();
      await checkpoint(`Turno ${first.code} registrado y pulsera asignada. Observá la fila de triaje.`);
    });
    await test.step('Lectura AES-GCM real → persistencia y signos vitales en la fila', async () => {
      const seq = await device.publish();
      await expect.poll(async () => (await gateway.wearable(deviceId)).lastReading?.seq).toBe(seq);
      await expect(pulse(first.code)).toHaveText('77lpm');
      await checkpoint('Lectura cifrada recibida y persistida: 77 lpm, SpO₂ 98 %.');
    });
    await test.step('Caída → alerta crítica → reconocimiento desde Backoffice', async () => {
      await device.publish({ fall: true, accPeakG: 3.2 });
      const overlay = page.getByRole('alertdialog');
      await expect(overlay.locator('h2')).toContainText(`Caída · ${first.code}`);
      const alert = await gateway.alert(first.id, 'FALL');
      await checkpoint(
        'Caída simulada: aviso crítico y alarma. A continuación se reconoce desde Backoffice.',
      );
      await overlay.getByRole('button', { name: 'Reconocer alerta', exact: true }).click();
      await expect(overlay).not.toBeVisible();
      const acknowledged = (await gateway.call<Alert[]>('GET', '/alerts?active=false')).find(
        (a) => a.id === alert.id,
      );
      expect(acknowledged?.status).toBe('ACKNOWLEDGED');
      expect(acknowledged?.acknowledgedBy?.id).toBe(user.id);
      await expect(row(first.code).locator('vt-level-pill')).toHaveText('Crítico');
    });
    await test.step('Llamado desde Backoffice → TV y SHOW_TICKET del cliente MQTT', async () => {
      const room = (await gateway.call<ConsultingRoom[]>('GET', '/consulting-rooms'))[0];
      await row(first.code).getByRole('button', { name: 'Llamar', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('radio').filter({ hasText: room.name }).click();
      await dialog.getByRole('button', { name: `Llamar a ${room.name}`, exact: true }).click();
      await expect(tv.locator('.call .code')).toHaveText(first.code);
      await expect(tv.locator('.call .room')).toHaveText(room.name);
      await expect
        .poll(() => device.commands.find((c) => c.value.ticketCode === first.code))
        .toEqual({
          topic: MQTT_TOPICS.wearableCommand(device.room, device.wearable.code),
          value: { type: 'SHOW_TICKET', ticketCode: first.code, consultingRoom: room.name },
        });
      await expect(tv.locator('body')).not.toContainText(device.wearable.code);
      await expect(tv.locator('body')).not.toContainText('Prueba');
      await checkpoint(`Llamado ${first.code} en la TV y comando SHOW_TICKET recibido por MQTT.`);
      await row(first.code).getByRole('button', { name: 'Pasar a atención', exact: true }).click();
      await row(first.code).getByRole('button', { name: 'Finalizar atención', exact: true }).click();
      await expect
        .poll(async () => (await gateway.call<Ticket>('GET', `/tickets/${first.id}`)).status)
        .toBe('DONE');
      expect((await gateway.wearable(deviceId)).ticket).toBeNull();
    });
    let missedFall: Alert;
    await test.step('Preparar otro turno y una alerta antes del corte', async () => {
      second = await gateway.checkIn('reconexión');
      await gateway.call('POST', `/wearables/${deviceId}/assign`, { ticketId: second.id });
      await device.publish({ hr: 78, fall: true, accPeakG: 3.2 });
      missedFall = await gateway.alert(second.id, 'FALL');
      await expect(page.getByRole('alertdialog').locator('h2')).toContainText(second.code);
      await expect(pulse(second.code)).toHaveText('78lpm');
    });
    await test.step('Cortar ambos clientes y cambiar alerta, lectura y llamado mientras están desconectados', async () => {
      await offlineStaff(true);
      await offlineTv(true);
      await expect(page.locator('header.topbar .conn')).toHaveText('Reconectando…');
      await expect(tv.getByRole('status')).toContainText('Reconectando');
      await gateway.call('POST', `/alerts/${missedFall.id}/ack`, {});
      await device.publish({ spo2: 85 });
      await gateway.alert(second.id, 'HYPOXIA');
      const seq = await device.publish({ hr: 88 });
      await expect.poll(async () => (await gateway.wearable(deviceId)).lastReading?.seq).toBe(seq);
      const room = (await gateway.call<ConsultingRoom[]>('GET', '/consulting-rooms'))[0];
      await device.close();
      await device.connect();
      await gateway.call('POST', `/tickets/${second.id}/call`, { consultingRoomId: room.id });
      await expect.poll(() => device.commands.some((c) => c.value.ticketCode === second.code)).toBe(true);
      await expect(tv.locator('.call .code')).toHaveText(first.code);
      await expect(pulse(second.code)).toHaveText('78lpm');
      await checkpoint(
        'Clientes desconectados; el gateway sigue guardando cambios y atendiendo solicitudes.',
      );
    });
    await test.step('Reconectar sin recargar: recuperar fila, signos vitales, alertas y último llamado', async () => {
      const navigations: string[] = [];
      page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) navigations.push(frame.url());
      });
      tv.on('framenavigated', (frame) => {
        if (frame === tv.mainFrame()) navigations.push(frame.url());
      });
      const snapshots = [
        page.waitForResponse((r) => r.url().includes('/api/alerts?active=true') && r.status() < 400, {
          timeout: 10_000,
        }),
        page.waitForResponse((r) => r.url().endsWith('/api/wearables') && r.status() < 400, {
          timeout: 10_000,
        }),
        page.waitForResponse((r) => r.url().endsWith('/api/tickets') && r.status() < 400, {
          timeout: 10_000,
        }),
        tv.waitForResponse((r) => r.url().endsWith('/api/tickets/recent-calls') && r.status() < 400, {
          timeout: 10_000,
        }),
      ];
      await offlineStaff(false);
      await offlineTv(false);
      await Promise.all(snapshots);
      await expect(page.locator('header.topbar .conn')).toHaveText('En vivo');
      await expect(tv.getByRole('status')).toHaveText('En vivo');
      await expect(pulse(second.code)).toHaveText('88lpm');
      await expect(row(second.code).locator('.status')).toHaveText('Llamado');
      await expect(tv.locator('.call .code')).toHaveText(second.code);
      const overlay = page.getByRole('alertdialog');
      await expect(overlay.locator('h2')).toContainText(`Hipoxia · ${second.code}`);
      await checkpoint('Reconexión sin recargar: nueva lectura, hipoxia y último llamado recuperados.');
      expect(navigations).toEqual([]);
      await overlay.getByRole('button', { name: 'Minimizar', exact: true }).click();
      await page
        .getByRole('navigation', { name: 'Secciones' })
        .getByRole('link', { name: /^Alertas/ })
        .click();
      const active = page.locator('li.item.active').filter({ hasText: second.code });
      await expect(active).toHaveCount(1);
      await expect(active).toContainText('Hipoxia');
      await active.getByRole('button', { name: 'Reconocer', exact: true }).click();
      await expect(active).toHaveCount(0);
    });
  } finally {
    await wearable?.close();
    try {
      await api?.cleanup();
    } finally {
      await api?.request.dispose();
      await staff.close();
      await tvContext.close();
    }
  }
});
