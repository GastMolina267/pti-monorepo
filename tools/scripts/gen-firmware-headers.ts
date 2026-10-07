/**
 * Genera los headers C/C++ del firmware a partir de @vitalia/contracts (fuente única):
 *
 *   apps/wearable-firmware-poc/include/vitalia_contracts.h    tópicos, cifrado, seq, ID y umbrales
 *   apps/wearable-firmware-poc/test/fixtures/gcm_vectors.h    vectores de prueba AES-256-GCM
 *
 *   pnpm fw:codegen            # regenera los headers
 *   pnpm fw:codegen --check    # falla si alguno no está al día (lo corre la CI)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CLINICAL_THRESHOLDS } from '../../libs/shared/contracts/src/lib/clinical/thresholds';
import { GCM_TEST_VECTORS } from '../../libs/shared/contracts/src/lib/telemetry/gcm-test-vectors';
import {
  ENVELOPE_VERSION,
  MQTT_QOS,
  MQTT_TOPIC_ROOT,
  MQTT_TOPICS,
  TELEMETRY_CIPHER,
} from '../../libs/shared/contracts/src/lib/telemetry/mqtt';
import { SEQ_BOOT_SHIFT } from '../../libs/shared/contracts/src/lib/telemetry/seq';
import {
  WEARABLE_NUMBER_MAX,
  WEARABLE_NUMBER_MIN,
} from '../../libs/shared/contracts/src/lib/telemetry/wearable-id';

const FIRMWARE = 'apps/wearable-firmware-poc';

function banner(source: string): string[] {
  return ['// GENERADO con `pnpm fw:codegen` desde', `// ${source} — NO EDITAR A MANO.`];
}

/** `heartRate` → `HEART_RATE`, `impactG` → `IMPACT_G`. */
function upperSnake(camel: string): string {
  return camel.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}

function floatLiteral(n: number): string {
  return Number.isInteger(n) ? `${n}.0f` : `${n}f`;
}

function renderContracts(): string {
  const thresholds: string[] = [];
  for (const [group, fields] of Object.entries(CLINICAL_THRESHOLDS)) {
    for (const [field, value] of Object.entries(fields)) {
      if (typeof value !== 'number') throw new Error(`Umbral no numérico: ${group}.${field}`);
      thresholds.push(`constexpr float ${upperSnake(group)}_${upperSnake(field)} = ${floatLiteral(value)};`);
    }
  }

  return [
    ...banner('libs/shared/contracts/src/lib/{telemetry,clinical}'),
    '// Constantes del contrato que el firmware tiene que respetar (docs/04-contratos.md).',
    '#pragma once',
    '',
    '#include <stdint.h>',
    '',
    'namespace vitalia {',
    '',
    '// --- MQTT ---',
    `constexpr const char* MQTT_TOPIC_ROOT = "${MQTT_TOPIC_ROOT}";`,
    `constexpr uint8_t MQTT_QOS = ${MQTT_QOS};`,
    '// snprintf(buf, len, FMT, sala, wearableId)',
    `constexpr const char* MQTT_TOPIC_DATA_FMT = "${MQTT_TOPICS.wearableData('%s', '%s')}";`,
    `constexpr const char* MQTT_TOPIC_CMD_FMT = "${MQTT_TOPICS.wearableCommand('%s', '%s')}";`,
    '',
    '// --- Sobre cifrado (ADR 0006) ---',
    `constexpr uint8_t ENVELOPE_VERSION = ${ENVELOPE_VERSION};`,
    `constexpr uint8_t CIPHER_KEY_BYTES = ${TELEMETRY_CIPHER.keyBytes};`,
    `constexpr uint8_t CIPHER_IV_BYTES = ${TELEMETRY_CIPHER.ivBytes};`,
    `constexpr uint8_t CIPHER_TAG_BYTES = ${TELEMETRY_CIPHER.tagBytes};`,
    '',
    '// --- seq = arranque << SEQ_BOOT_SHIFT | contador ---',
    `constexpr uint8_t SEQ_BOOT_SHIFT = ${SEQ_BOOT_SHIFT};`,
    '',
    '// --- Identificador wb-<NN>-<mac> (ADR 0011) ---',
    `constexpr int WEARABLE_NUMBER_MIN = ${WEARABLE_NUMBER_MIN};`,
    `constexpr int WEARABLE_NUMBER_MAX = ${WEARABLE_NUMBER_MAX};`,
    '',
    '// --- Umbrales clínicos (CLINICAL_THRESHOLDS) ---',
    ...thresholds,
    '',
    '}  // namespace vitalia',
    '',
  ].join('\n');
}

function bytes(name: string, hex: string): string {
  const values = (hex.match(/../g) ?? []).map((b) => `0x${b}`);
  const lines: string[] = [];
  for (let i = 0; i < values.length; i += 12) lines.push(`  ${values.slice(i, i + 12).join(', ')},`);
  return `static const uint8_t ${name}[${values.length}] = {\n${lines.join('\n')}\n};`;
}

function renderVectors(): string {
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
    ...banner('libs/shared/contracts/src/lib/telemetry/gcm-test-vectors.ts'),
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

const OUTPUTS = [
  { path: `${FIRMWARE}/include/vitalia_contracts.h`, content: renderContracts() },
  { path: `${FIRMWARE}/test/fixtures/gcm_vectors.h`, content: renderVectors() },
];

if (process.argv.includes('--check')) {
  const stale = OUTPUTS.filter(({ path, content }) => {
    const file = join(process.cwd(), path);
    const current = existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
    return current !== content;
  });
  if (stale.length > 0) {
    for (const { path } of stale) console.error(`✖ ${path} está desactualizado.`);
    console.error('  Corré `pnpm fw:codegen` y commiteá los headers.');
    process.exit(1);
  }
  console.log(`✔ ${OUTPUTS.length} headers del firmware al día`);
} else {
  for (const { path, content } of OUTPUTS) {
    const file = join(process.cwd(), path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    console.log(`✔ ${path}`);
  }
}
