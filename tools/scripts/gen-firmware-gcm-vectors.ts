/**
 * Genera el header C con los vectores AES-256-GCM de @vitalia/contracts para el firmware.
 * Fuente única: libs/shared/contracts/src/lib/telemetry/gcm-test-vectors.ts
 *
 *   pnpm fw:vectors            # regenera apps/wearable-firmware-poc/test/fixtures/gcm_vectors.h
 *   pnpm fw:vectors --check    # falla si el header no está al día (lo corre la CI)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { GCM_TEST_VECTORS } from '../../libs/shared/contracts/src/lib/telemetry/gcm-test-vectors';

const OUTPUT = join(process.cwd(), 'apps/wearable-firmware-poc/test/fixtures/gcm_vectors.h');

function bytes(name: string, hex: string): string {
  const values = (hex.match(/../g) ?? []).map((b) => `0x${b}`);
  const lines: string[] = [];
  for (let i = 0; i < values.length; i += 12) lines.push(`  ${values.slice(i, i + 12).join(', ')},`);
  return `static const uint8_t ${name}[${values.length}] = {\n${lines.join('\n')}\n};`;
}

function render(): string {
  const arrays: string[] = [];
  const entries: string[] = [];
  for (const v of GCM_TEST_VECTORS) {
    arrays.push(
      `// ${v.name}: ${v.description}`,
      bytes(`${v.name}_key`, v.keyHex),
      bytes(`${v.name}_iv`, v.ivHex),
      bytes(`${v.name}_plaintext`, v.plaintextHex),
      bytes(`${v.name}_ct`, v.ctHex),
      bytes(`${v.name}_tag`, v.tagHex),
      '',
    );
    entries.push(
      `  {"${v.name}", ${v.name}_key, ${v.name}_iv, ${v.name}_plaintext, sizeof(${v.name}_plaintext), ` +
        `${v.name}_ct, ${v.name}_tag, ${v.expect === 'ok'}},`,
    );
  }

  return [
    '// GENERADO con `pnpm fw:vectors` desde',
    '// libs/shared/contracts/src/lib/telemetry/gcm-test-vectors.ts — NO EDITAR A MANO.',
    '// AES-256-GCM: clave de 32 bytes, IV de 12, tag de 16, sin AAD (ADR 0006).',
    '#pragma once',
    '',
    '#include <stdbool.h>',
    '#include <stddef.h>',
    '#include <stdint.h>',
    '',
    'typedef struct {',
    '  const char* name;',
    '  const uint8_t* key;        // 32 bytes',
    '  const uint8_t* iv;         // 12 bytes',
    '  const uint8_t* plaintext;',
    '  size_t plaintext_len;      // = largo de ct',
    '  const uint8_t* ct;',
    '  const uint8_t* tag;        // 16 bytes',
    '  bool expect_ok;            // false: el descifrado tiene que fallar (tag inválido)',
    '} gcm_test_vector_t;',
    '',
    ...arrays,
    'static const gcm_test_vector_t GCM_TEST_VECTORS[] = {',
    ...entries,
    '};',
    '',
    'static const size_t GCM_TEST_VECTORS_COUNT = sizeof(GCM_TEST_VECTORS) / sizeof(GCM_TEST_VECTORS[0]);',
    '',
  ].join('\n');
}

const content = render();

if (process.argv.includes('--check')) {
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8').replace(/\r\n/g, '\n') : '';
  if (current !== content) {
    console.error('✖ gcm_vectors.h está desactualizado. Corré `pnpm fw:vectors` y commiteá el header.');
    process.exit(1);
  }
  console.log('✔ gcm_vectors.h al día');
} else {
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, content);
  console.log(
    `✔ ${GCM_TEST_VECTORS.length} vectores → apps/wearable-firmware-poc/test/fixtures/gcm_vectors.h`,
  );
}
