import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { acquireGatewayLock } from './gateway-lock.mjs';

test('impide dos operaciones simultáneas y libera el bloqueo al terminar', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vitalia-lock-'));
  try {
    const release = acquireGatewayLock(directory);
    assert.throws(() => acquireGatewayLock(directory), /bloqueo operativo/);
    release();
    acquireGatewayLock(directory)();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
