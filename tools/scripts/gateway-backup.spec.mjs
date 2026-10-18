import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { validateBackup } from './gateway-backup.mjs';

test('el respaldo exige archivo de base y credenciales íntegros y rechaza rutas externas', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vitalia-backup-'));
  try {
    mkdirSync(join(directory, 'mqtt'));
    const files = {};
    for (const file of ['database.dump', '.env', 'mqtt/devices.json', 'mqtt/users', 'mqtt/acl']) {
      writeFileSync(join(directory, file), 'simulado');
      files[file] = createHash('sha256').update('simulado').digest('hex');
    }
    const save = () => writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ version: 1, files }));
    save();
    assert.equal(validateBackup(directory).version, 1);
    writeFileSync(join(directory, '.env'), 'alterado');
    assert.throws(() => validateBackup(directory), /Integridad/);
    writeFileSync(join(directory, '.env'), 'simulado');
    files['../outside'] = files['.env'];
    save();
    assert.throws(() => validateBackup(directory), /Integridad/);
    delete files['../outside'];
    delete files['mqtt/devices.json'];
    save();
    assert.throws(() => validateBackup(directory), /incompleto/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
