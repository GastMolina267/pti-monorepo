import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  quickTunnelUrl,
  tunnelComposeArgs,
  tunnelEnvironment,
  tunnelMode,
  TUNNEL_SERVICES,
} from './gateway-tunnel.mjs';

test('toma la última URL de túnel rápido de los logs de cloudflared', () => {
  const log = [
    'tunnel-tv-1  | INF Requesting new quick Tunnel on trycloudflare.com...',
    'tunnel-tv-1  | INF |  https://viejo-nombre-uno.trycloudflare.com  |',
    'tunnel-tv-1  | INF |  https://Sala-Espera-Doble-Luz.trycloudflare.com  |',
    'tunnel-tv-1  | INF Registered tunnel connection connIndex=0',
  ].join('\n');
  assert.equal(quickTunnelUrl(log), 'https://sala-espera-doble-luz.trycloudflare.com');
  assert.equal(quickTunnelUrl('INF Starting tunnel'), null);
  assert.equal(
    quickTunnelUrl('ERR failed to request quick Tunnel: Post "https://api.trycloudflare.com/tunnel": EOF'),
    null,
  );
});

test('con token usa el túnel con nombre; sin token, los rápidos', () => {
  assert.equal(tunnelMode({}), 'quick');
  assert.equal(tunnelMode({ CLOUDFLARE_TUNNEL_TOKEN: '   ' }), 'quick');
  assert.equal(tunnelMode({ CLOUDFLARE_TUNNEL_TOKEN: 'eyJh' }), 'named');
});

test('sube el perfil que corresponde y baja solo landing y túneles', () => {
  assert.deepEqual(tunnelComposeArgs('up', 'quick').slice(0, 3), ['--profile', 'tunnel', 'up']);
  assert.deepEqual(tunnelComposeArgs('up', 'named').slice(0, 3), ['--profile', 'tunnel-named', 'up']);
  const down = tunnelComposeArgs('down', 'quick');
  assert.deepEqual(down.slice(-TUNNEL_SERVICES.length), TUNNEL_SERVICES);
  for (const core of ['api', 'web', 'postgres', 'mosquitto']) assert.ok(!down.includes(core));
  assert.throws(() => tunnelComposeArgs('restart', 'quick'));
});

test('dos saltos de proxy detrás del túnel, salvo que .gateway/.env diga otra cosa', () => {
  assert.deepEqual(tunnelEnvironment({}), { GATEWAY_TRUST_PROXY: '2' });
  assert.deepEqual(tunnelEnvironment({ GATEWAY_TRUST_PROXY: '1' }), { GATEWAY_TRUST_PROXY: '1' });
});
