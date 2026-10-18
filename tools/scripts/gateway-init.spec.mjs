import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { initializeGateway, readGatewaySettings } from './gateway-init.mjs';

const directories = [];
const directory = () => {
  const path = mkdtempSync(join(tmpdir(), 'vitalia-gateway-'));
  directories.push(path);
  return path;
};
afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

test('genera credenciales válidas y distintas para cada instalación', () => {
  const first = directory();
  const second = directory();
  assert.equal(initializeGateway(first).created, true);
  initializeGateway(second);
  const a = readGatewaySettings(first);
  const b = readGatewaySettings(second);
  assert.match(a.TELEMETRY_AES_KEY, /^[0-9a-f]{64}$/);
  assert.ok(a.JWT_SECRET.length >= 32);
  // Sin escapes adicionales al interpolar la contraseña en DATABASE_URL.
  assert.match(a.POSTGRES_PASSWORD, /^[A-Za-z0-9_-]{32}$/);
  for (const name of ['POSTGRES_PASSWORD', 'JWT_SECRET', 'TELEMETRY_AES_KEY', 'SEED_PASSWORD']) {
    assert.notEqual(a[name], b[name]);
  }
});

test('conserva byte a byte un archivo existente, incluso si fue editado', () => {
  const dir = directory();
  const file = join(dir, '.env');
  const content = '# Edición del operador\nGATEWAY_HTTP_PORT=9080\n';
  writeFileSync(file, content);
  assert.equal(initializeGateway(dir).created, false);
  assert.equal(readFileSync(file, 'utf8'), content);
  assert.equal(readGatewaySettings(dir).GATEWAY_HTTP_PORT, '9080');
});
