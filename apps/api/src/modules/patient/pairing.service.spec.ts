import { UnauthorizedException } from '@nestjs/common';
import { PAIRING_CODE_ALPHABET, PAIRING_CODE_LENGTH, PAIRING_CODE_TTL_MINUTES } from '@vitalia/contracts';
import { normalizePairingCode, PairingService } from './pairing.service';

describe('PairingService', () => {
  const t0 = Date.UTC(2026, 9, 25, 15, 0, 0);

  it('genera códigos legibles de un solo uso', () => {
    const pairing = new PairingService();
    const { code, expiresAt } = pairing.create('ticket-1', t0);
    expect(code).toHaveLength(PAIRING_CODE_LENGTH);
    expect([...code].every((c) => PAIRING_CODE_ALPHABET.includes(c))).toBe(true);
    expect(expiresAt.getTime() - t0).toBe(PAIRING_CODE_TTL_MINUTES * 60_000);

    expect(pairing.redeem(` ${code.slice(0, 3).toLowerCase()}-${code.slice(3)} `, t0 + 1000)).toBe(
      'ticket-1',
    );
    expect(() => pairing.redeem(code, t0 + 2000)).toThrow(UnauthorizedException);
  });

  it('vence a los 10 minutos y un código nuevo invalida el anterior', () => {
    const pairing = new PairingService();
    const old = pairing.create('ticket-1', t0).code;
    const fresh = pairing.create('ticket-1', t0 + 1000).code;
    expect(() => pairing.redeem(old, t0 + 2000)).toThrow('pedile uno nuevo');

    const other = pairing.create('ticket-2', t0).code;
    expect(() => pairing.redeem(other, t0 + PAIRING_CODE_TTL_MINUTES * 60_000)).toThrow(
      UnauthorizedException,
    );
    expect(pairing.redeem(fresh, t0 + 5000)).toBe('ticket-1');
  });

  it('el alfabeto no tiene caracteres que se confunden', () => {
    expect(PAIRING_CODE_ALPHABET).not.toMatch(/[01OIL5S]/);
    expect(new Set(PAIRING_CODE_ALPHABET).size).toBe(PAIRING_CODE_ALPHABET.length);
    expect(normalizePairingCode('ab c-d')).toBe('ABCD');
  });
});
