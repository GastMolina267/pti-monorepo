import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gatewayComposeInvocation } from './gateway-compose.mjs';

test('el gateway gana al entorno dev que Nx hereda, conservando PATH y argumentos', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vitalia-compose-'));
  try {
    writeFileSync(
      join(directory, '.env'),
      'MQTT_USERNAME=gateway-api\nMQTT_PASSWORD=gateway-password\nPOSTGRES_PASSWORD=gateway-database\n',
    );
    const invocation = gatewayComposeInvocation(
      ['up', '--wait'],
      {
        PATH: '/bin',
        MQTT_USERNAME: '',
        MQTT_PASSWORD: '',
        POSTGRES_PASSWORD: 'dev',
      },
      directory,
    );
    assert.equal(invocation.env.MQTT_USERNAME, 'gateway-api');
    assert.equal(invocation.env.MQTT_PASSWORD, 'gateway-password');
    assert.equal(invocation.env.POSTGRES_PASSWORD, 'gateway-database');
    assert.equal(invocation.env.PATH, '/bin');
    assert.deepEqual(invocation.args.slice(-2), ['up', '--wait']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
