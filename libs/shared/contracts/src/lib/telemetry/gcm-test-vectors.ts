import type { EncryptedEnvelope } from './mqtt';

/**
 * Vectores de prueba AES-256-GCM compartidos entre la API y el firmware (ADR 0006).
 * IV de 12 bytes, tag de 16 bytes y **sin AAD**, igual que el sobre `EncryptedEnvelope`.
 *
 * - La API los usa en los tests de descifrado del módulo `telemetry`.
 * - El firmware los recibe como `apps/wearable-firmware-poc/test/fixtures/gcm_vectors.h`,
 *   generado con `pnpm fw:vectors` (no editar el header a mano).
 *
 * Solo datos: este archivo no importa crypto, así la lib sigue siendo apta para el navegador.
 * La verificación con `node:crypto` está en `gcm-test-vectors.spec.ts`.
 */
export interface GcmTestVector {
  /** Identificador estable (también es el nombre del símbolo en el header C). */
  name: string;
  description: string;
  keyHex: string;
  ivHex: string;
  plaintextHex: string;
  ctHex: string;
  tagHex: string;
  /** `reject`: el tag no corresponde y el descifrado tiene que fallar. */
  expect: 'ok' | 'reject';
  /** El mismo vector empaquetado como lo publica el wearable. */
  envelope?: EncryptedEnvelope;
}

/** Clave de prueba `00 01 … 1f`. Solo para tests: nunca usarla como `TELEMETRY_AES_KEY`. */
const VITALIA_TEST_KEY_HEX = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
const VITALIA_TEST_IV_HEX = '000102030405060708090a0b';
/** `{"wearableId":"wb-01-24d7cc","seq":1,"ts":1791065563577,"hr":78,"spo2":98,"temp":36.6,"accPeakG":1.02,"fall":false}` */
const VITALIA_READING_HEX =
  '7b227765617261626c654964223a2277622d30312d323464376363222c22736571223a312c227473223a313739313036353536333537372c226872223a37382c2273706f32223a39382c2274656d70223a33362e362c226163635065616b47223a312e30322c2266616c6c223a66616c73657d';
const VITALIA_READING_CT_HEX =
  '3c20a17ea497a379e124deef93d35a1ae1fbb705dd496b180f0486a7314b73d7703294cd83e366eb569e4edab1b6180edb6c56be6fe194f61dff583b22d4cdc2d24fb615e1f31c582478881a8ae27eca02b9ff4c404f71099e9ecea9199bfeaff1c977d6966dea7cff70529072134013c9021f';

export const GCM_TEST_VECTORS: readonly GcmTestVector[] = [
  {
    name: 'nist_tc15',
    description: 'NIST, especificación de GCM, Test Case 15 (AES-256, IV de 96 bits, sin AAD)',
    keyHex: 'feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308',
    ivHex: 'cafebabefacedbaddecaf888',
    plaintextHex:
      'd9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b391aafd255',
    ctHex:
      '522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662898015ad',
    tagHex: 'b094dac5d93471bdec1a502270e3cc6c',
    expect: 'ok',
  },
  {
    name: 'vitalia_reading',
    description: 'TelemetryReading de wb-01-24d7cc con la clave de prueba 00..1f',
    keyHex: VITALIA_TEST_KEY_HEX,
    ivHex: VITALIA_TEST_IV_HEX,
    plaintextHex: VITALIA_READING_HEX,
    ctHex: VITALIA_READING_CT_HEX,
    tagHex: 'fce5adbe47e05f2a7e7074b1eaee7a16',
    expect: 'ok',
    envelope: {
      v: 1,
      iv: 'AAECAwQFBgcICQoL',
      ct: 'PCChfqSXo3nhJN7vk9NaGuH7twXdSWsYDwSGpzFLc9dwMpTNg+Nm61aeTtqxthgO22xWvm/hlPYd/1g7ItTNwtJPthXh8xxYJHiIGorifsoCuf9MQE9xCZ6ezqkZm/6v8cl31pZt6nz/cFKQchNAE8kCHw==',
      tag: '/OWtvkfgXyp+cHSx6u56Fg==',
    },
  },
  {
    name: 'vitalia_reading_bad_tag',
    description: 'Igual que vitalia_reading con el último byte del tag alterado: el gateway lo descarta',
    keyHex: VITALIA_TEST_KEY_HEX,
    ivHex: VITALIA_TEST_IV_HEX,
    plaintextHex: VITALIA_READING_HEX,
    ctHex: VITALIA_READING_CT_HEX,
    tagHex: 'fce5adbe47e05f2a7e7074b1eaee7a17',
    expect: 'reject',
  },
];
