import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { connectionCredentials, gatewayEnvironment, loadDevicePasswords } from './credentials';
import { UsageError } from './cli';

describe('credenciales MQTT por pulsera', () => {
  let directory: string;
  const password = 'contraseña-simulada-123';
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'vitalia-credentials-'));
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  it('el gateway toma su clave y puerto y descarta las credenciales de servicio', () => {
    writeFileSync(
      join(directory, '.env'),
      'TELEMETRY_AES_KEY=abc\nGATEWAY_MQTT_PORT=1999\nMQTT_USERNAME=api\nMQTT_PASSWORD=secreto-api\n',
    );
    expect(gatewayEnvironment(directory)).toEqual({
      MQTT_URL: 'mqtt://localhost:1999',
      TELEMETRY_AES_KEY: 'abc',
      MQTT_CREDENTIALS_FILE: resolve(directory, 'mqtt/devices.json'),
      MQTT_USERNAME: '',
      MQTT_PASSWORD: '',
    });
  });

  it('un gateway sin inicializar falla con una indicación de arranque', () => {
    expect(() => gatewayEnvironment(directory)).toThrow(/gateway:up/);
  });

  it('carga y selecciona la identidad individual, sin heredar la cuenta API', () => {
    const file = join(directory, 'devices.json');
    writeFileSync(file, JSON.stringify({ 'wb-02-5e0002': password }));
    const devices = loadDevicePasswords(file);
    expect(connectionCredentials('wb-02-5e0002', devices, { username: 'api', password: 'api' })).toEqual({
      username: 'wb-02-5e0002',
      password,
    });
    expect(() => connectionCredentials('wb-03-5e0003', devices, { username: 'api' })).toThrow(
      /Faltan credenciales/,
    );
  });

  it('un archivo malformado no revela su contenido ni usa la cuenta de respaldo', () => {
    const file = join(directory, 'invalid.json');
    writeFileSync(file, '{SECRETO');
    expect(() => loadDevicePasswords(file)).toThrow(UsageError);
    expect(() => loadDevicePasswords(file)).toThrow('No se pudo validar el archivo de credenciales MQTT');
    expect(() => loadDevicePasswords(join(directory, 'missing'))).toThrow(UsageError);
  });

  it('conserva el modo de desarrollo sin archivo de dispositivos', () => {
    expect(loadDevicePasswords()).toBeUndefined();
    expect(connectionCredentials('wb-02-5e0002', undefined, {})).toEqual({});
    expect(connectionCredentials('wb-02-5e0002', undefined, { username: 'dev', password })).toEqual({
      username: 'dev',
      password,
    });
    expect(() => connectionCredentials('wb-02-5e0002', {}, {})).toThrow(UsageError);
  });
});
