import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { REALTIME_READY_EVENT, REALTIME_ROOMS, type HealthResponse } from '@vitalia/contracts';
import { gatewayHost } from '../wearable-simulator/src/lib/gateway-host';
import { readGatewaySettings } from './gateway-init.mjs';

const settings = readGatewaySettings();
const origins = [settings.GATEWAY_HTTP_PORT, settings.GATEWAY_TV_PORT].map(
  (port) => `http://${gatewayHost(settings.GATEWAY_HTTP_BIND)}:${port}`,
);

async function request(origin: string, path: string) {
  const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, 200, `${origin}${path}`);
  return response;
}

async function checkSocket(origin: string, transports: ('websocket' | 'polling')[]) {
  const socket = io(origin, { auth: { role: 'tv' }, transports, autoConnect: false, reconnection: false });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Socket.IO sin ready en ${origin}`)), 10_000);
      socket.once(REALTIME_READY_EVENT, ({ room }: { room: string }) => {
        clearTimeout(timeout);
        try {
          assert.equal(room, REALTIME_ROOMS.TV);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      socket.once('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      socket.connect();
    });
  } finally {
    socket.disconnect();
  }
}

async function main(): Promise<void> {
  for (const origin of origins) {
    const html = await (await request(origin, '/')).text();
    assert.match(html, /<vt-root/);
    assert.match(await (await request(origin, '/ruta-de-prueba')).text(), /<vt-root/);
    const health = (await (await request(origin, '/api/health')).json()) as HealthResponse;
    assert.equal(health.status, 'ok');
    assert.ok(health.checks.some((check) => check.name === 'database' && check.status === 'ok'));
    assert.ok(health.checks.some((check) => check.name === 'mqtt' && check.status === 'ok'));
    assert.ok(Array.isArray(await (await request(origin, '/api/tickets/recent-calls')).json()));
    await checkSocket(origin, ['websocket']);
    await checkSocket(origin, ['polling']);
    console.log(`Gateway OK: HTML, rutas SPA, API, base, broker y Socket.IO en ${origin}`);
  }
}

main().catch((err: unknown) => {
  console.error('Smoke del gateway falló:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
