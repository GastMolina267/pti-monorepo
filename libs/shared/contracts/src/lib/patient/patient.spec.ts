import { describe, expect, it } from 'vitest';
import {
  PAIRING_CODE_ALPHABET,
  PAIRING_CODE_LENGTH,
  PATIENT_PRIORITY_LABELS,
  pairingQrText,
  parsePairingCode,
} from './patient';

describe('vinculación de la app del paciente', () => {
  it('el QR lleva el código y se lee de vuelta', () => {
    expect(pairingQrText('K7M2QX')).toBe('vitalia://vincular?codigo=K7M2QX');
    expect(parsePairingCode(pairingQrText('K7M2QX'))).toBe('K7M2QX');
    expect(parsePairingCode(' k7m 2qx ')).toBe('K7M2QX');
    expect(parsePairingCode('VITALIA://VINCULAR?CODIGO=k7m-2qx')).toBe('K7M2QX');
  });

  it('rechaza lo que no es un código', () => {
    expect(parsePairingCode('https://ejemplo.com')).toBeNull();
    expect(parsePairingCode('K7M2Q')).toBeNull();
    expect(parsePairingCode('K7M2Q0')).toBeNull(); // 0 no está en el alfabeto
  });

  it('el alfabeto evita caracteres que se confunden y la prioridad no dice «Crítico»', () => {
    expect(PAIRING_CODE_ALPHABET).not.toMatch(/[01OIL5S]/);
    expect(PAIRING_CODE_LENGTH).toBe(6);
    expect(Object.values(PATIENT_PRIORITY_LABELS).join(' ')).not.toMatch(/crítico/i);
  });
});
