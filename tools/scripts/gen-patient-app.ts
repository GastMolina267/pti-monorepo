/**
 * Genera las constantes Dart de la app del paciente a partir de las fuentes únicas del monorepo
 * (@vitalia/contracts y @vitalia/design-tokens), como `fw:codegen` hace con el firmware:
 *
 *   apps/patient-app/lib/generated/vitalia_contracts.g.dart
 *
 *   pnpm app:codegen            # regenera el archivo
 *   pnpm app:codegen --check    # falla si no está al día (lo corre la CI)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { COLORS, NEUTRALS, TRIAGE_COLORS } from '../../libs/shared/design-tokens/src/lib/brand';
import { API_PREFIX } from '../../libs/shared/contracts/src/lib/api';
import { CLINICAL_THRESHOLDS } from '../../libs/shared/contracts/src/lib/clinical/thresholds';
import { TRIAGE_LEVEL_LABELS, TRIAGE_LEVELS } from '../../libs/shared/contracts/src/lib/clinical/triage';
import {
  VITALS_HISTORY_DEFAULT_MINUTES,
  VITALS_HISTORY_MAX_MINUTES,
} from '../../libs/shared/contracts/src/lib/iomt/readings';
import {
  PAIRING_CODE_ALPHABET,
  PAIRING_CODE_LENGTH,
  PAIRING_QR_PREFIX,
  PAIRING_CODE_TTL_MINUTES,
  PATIENT_PRIORITY_LABELS,
  PATIENT_SESSION_HOURS,
} from '../../libs/shared/contracts/src/lib/patient/patient';
import {
  REALTIME_ERROR_EVENT,
  REALTIME_EVENTS,
  REALTIME_READY_EVENT,
} from '../../libs/shared/contracts/src/lib/realtime/events';
import {
  OPEN_TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
} from '../../libs/shared/contracts/src/lib/tickets/tickets';

export const OUTPUT = 'apps/patient-app/lib/generated/vitalia_contracts.g.dart';

/** `#0D9488` → `Color(0xFF0D9488)`. */
export function dartColor(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Color inválido para Dart: ${hex}`);
  return `Color(0xFF${m[1].toUpperCase()})`;
}

/** Literal de string Dart con comillas simples. */
export function dartString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$')}'`;
}

/** Ancho de línea de `dart format` (analysis_options.yaml de la app). */
const PAGE_WIDTH = 120;

/**
 * `const nombre = <K, V>{...};` igual que lo deja `dart format`: en una línea si entra en
 * {@link PAGE_WIDTH}; si no, una entrada por línea con coma final.
 */
export function dartConst(head: string, open: string, close: string, items: string[]): string {
  const oneLine = `${head}${open}${items.join(', ')}${close};`;
  if (oneLine.length <= PAGE_WIDTH) return oneLine;
  return `${head}${open}\n${items.map((i) => `  ${i},`).join('\n')}\n${close};`;
}

const mapEntries = (entries: Record<string, string>) =>
  Object.entries(entries).map(([k, v]) => `${dartString(k)}: ${dartString(v)}`);

const colorFields = (obj: Record<string, string>, indent = '  ') =>
  Object.entries(obj)
    .map(([k, v]) => `${indent}static const ${k} = ${dartColor(v)};`)
    .join('\n');

export function renderDart(): string {
  const t = CLINICAL_THRESHOLDS;
  return [
    '// GENERADO con `pnpm app:codegen` desde @vitalia/contracts y @vitalia/design-tokens.',
    '// NO EDITAR A MANO: cambiá la fuente en libs/shared y volvé a generar.',
    '// ignore_for_file: constant_identifier_names',
    '',
    "import 'dart:ui' show Color;",
    '',
    '/// Colores de la marca Vitalia (`libs/shared/design-tokens/src/lib/brand.ts`).',
    'abstract final class VtColors {',
    colorFields(COLORS),
    '}',
    '',
    '/// Neutros del modo claro.',
    'abstract final class VtLight {',
    colorFields(NEUTRALS.light),
    '}',
    '',
    '/// Neutros del modo oscuro.',
    'abstract final class VtDark {',
    colorFields(NEUTRALS.dark),
    '}',
    '',
    '/// Umbrales clínicos (`CLINICAL_THRESHOLDS`): bandas normales de la curva.',
    'abstract final class VtThresholds {',
    `  static const heartRateNormalMin = ${t.heartRate.normalMin};`,
    `  static const heartRateNormalMax = ${t.heartRate.normalMax};`,
    `  static const heartRateCriticalMin = ${t.heartRate.criticalMin};`,
    `  static const heartRateCriticalMax = ${t.heartRate.criticalMax};`,
    `  static const spo2NormalMin = ${t.spo2.normalMin};`,
    `  static const spo2CriticalBelow = ${t.spo2.criticalBelow};`,
    `  static const temperatureFeverAbove = ${t.temperature.feverAbove};`,
    `  static const temperatureCriticalAbove = ${t.temperature.criticalAbove};`,
    `  static const temperatureHypothermiaBelow = ${t.temperature.hypothermiaBelow};`,
    '}',
    '',
    '/// API y tiempo real.',
    'abstract final class VtApi {',
    `  static const prefix = ${dartString(API_PREFIX)};`,
    `  static const readyEvent = ${dartString(REALTIME_READY_EVENT)};`,
    `  static const errorEvent = ${dartString(REALTIME_ERROR_EVENT)};`,
    `  static const ticketCalledEvent = ${dartString(REALTIME_EVENTS.TICKET_CALLED)};`,
    `  static const queueUpdatedEvent = ${dartString(REALTIME_EVENTS.QUEUE_UPDATED)};`,
    `  static const checkInSource = ${dartString('PATIENT_APP')};`,
    `  static const vitalsDefaultMinutes = ${VITALS_HISTORY_DEFAULT_MINUTES};`,
    `  static const vitalsMaxMinutes = ${VITALS_HISTORY_MAX_MINUTES};`,
    '}',
    '',
    '/// Sesión de turno y código de vinculación (ADR 0019).',
    'abstract final class VtPatient {',
    `  static const sessionHours = ${PATIENT_SESSION_HOURS};`,
    `  static const pairingCodeLength = ${PAIRING_CODE_LENGTH};`,
    `  static const pairingCodeTtlMinutes = ${PAIRING_CODE_TTL_MINUTES};`,
    `  static const pairingCodeAlphabet = ${dartString(PAIRING_CODE_ALPHABET)};`,
    `  static const pairingQrPrefix = ${dartString(PAIRING_QR_PREFIX)};`,
    '}',
    '',
    dartConst('const ticketStatuses = <String>', '[', ']', TICKET_STATUSES.map(dartString)),
    dartConst('const openTicketStatuses = <String>', '[', ']', OPEN_TICKET_STATUSES.map(dartString)),
    dartConst('const ticketStatusLabels = <String, String>', '{', '}', mapEntries(TICKET_STATUS_LABELS)),
    '',
    dartConst('const triageLevels = <String>', '[', ']', TRIAGE_LEVELS.map(dartString)),
    dartConst('const triageLevelLabels = <String, String>', '{', '}', mapEntries(TRIAGE_LEVEL_LABELS)),
    '',
    '/// Cómo se le muestra el triaje al paciente: prioridad, no diagnóstico.',
    dartConst('const patientPriorityLabels = <String, String>', '{', '}', mapEntries(PATIENT_PRIORITY_LABELS)),
    '',
    dartConst(
      'const triageColors = <String, Color>',
      '{',
      '}',
      Object.entries(TRIAGE_COLORS).map(([k, v]) => `${dartString(k)}: ${dartColor(v)}`),
    ),
    '',
  ].join('\n');
}

function main(): void {
  const content = renderDart();
  const file = join(process.cwd(), OUTPUT);
  if (process.argv.includes('--check')) {
    const current = existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
    if (current !== content) {
      console.error(`✖ ${OUTPUT} está desactualizado.`);
      console.error('  Corré `pnpm app:codegen` y commiteá el archivo.');
      process.exit(1);
    }
    console.log('✔ constantes de la app del paciente al día');
    return;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  console.log(`✔ ${OUTPUT}`);
}

if (process.argv[1]?.endsWith('gen-patient-app.ts')) main();
