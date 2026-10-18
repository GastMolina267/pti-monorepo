import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { initializeGateway, readGatewaySettings } from './gateway-init.mjs';
import { configureGatewayMqtt } from './gateway-mqtt-config';

const directories: string[] = [];
function directory(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vitalia-mqtt-'));
  directories.push(dir);
  initializeGateway(dir);
  return dir;
}
afterEach(() => {
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test('agrega identidades separadas sin rotar secretos ni datos de 4a', () => {
  const dir = directory();
  const before = readGatewaySettings(dir);
  assert.equal(configureGatewayMqtt(dir), 8);
  const after = readGatewaySettings(dir);
  for (const [key, value] of Object.entries(before)) assert.equal(after[key], value);
  assert.notEqual(after.MQTT_PASSWORD, after.MQTT_HEALTH_PASSWORD);
  const devices = readFileSync(join(dir, 'mqtt/devices.json'), 'utf8');
  configureGatewayMqtt(dir);
  assert.deepEqual(readGatewaySettings(dir), after);
  assert.equal(readFileSync(join(dir, 'mqtt/devices.json'), 'utf8'), devices);
});

test('alta incremental y revocación en el archivo no recrean identidades anteriores', () => {
  const dir = directory();
  configureGatewayMqtt(dir);
  const file = join(dir, 'mqtt/devices.json');
  const before = JSON.parse(readFileSync(file, 'utf8'));
  delete before['wb-01-24d7cc'];
  writeFileSync(file, JSON.stringify(before));
  assert.equal(configureGatewayMqtt(dir, ['wb-09-5e0009']), 8);
  const after = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(after['wb-01-24d7cc'], undefined);
  for (const [code, password] of Object.entries(before)) assert.equal(after[code], password);
  assert.ok(after['wb-09-5e0009']);
});

test('ACL explícitas: ningún patrón global comparte permisos con las cuentas de servicio', () => {
  const dir = directory();
  configureGatewayMqtt(dir);
  const acl = readFileSync(join(dir, 'mqtt/acl'), 'utf8');
  assert.doesNotMatch(acl, /^pattern /m);
  assert.match(
    acl,
    /user vitalia-api\ntopic read hospital\/\+\/wearable\/\+\/data\ntopic write hospital\/\+\/wearable\/\+\/cmd/,
  );
  assert.match(acl, /user vitalia-health\ntopic read \$SYS\/broker\/uptime\n\nuser wb-/);
});

test('rechaza entradas malformadas antes de reemplazar archivos de configuración', () => {
  const dir = directory();
  configureGatewayMqtt(dir);
  const file = join(dir, 'mqtt/devices.json');
  const invalid = '{"wb-02-5e0002":"secreto-no-valido"';
  writeFileSync(file, invalid);
  const envBefore = readFileSync(join(dir, '.env'), 'utf8');
  assert.throws(() => configureGatewayMqtt(dir), /No se pudo validar/);
  assert.equal(readFileSync(file, 'utf8'), invalid);
  assert.equal(readFileSync(join(dir, '.env'), 'utf8'), envBefore);
  assert.throws(() => configureGatewayMqtt(dir, ['intruso\nuser admin']), /Usá --wearable/);
});
