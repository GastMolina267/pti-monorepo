import { randomInt } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PAIRING_CODE_ALPHABET, PAIRING_CODE_LENGTH, PAIRING_CODE_TTL_MINUTES } from '@vitalia/contracts';

interface Pending {
  ticketId: string;
  expiresAt: number;
}

/** Normaliza lo que escribe el paciente: mayúsculas, sin espacios ni guiones. */
export function normalizePairingCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Códigos de vinculación de un solo uso (10 min). Viven en memoria: el gateway es una sola
 * instancia y, si la API se reinicia, el personal genera otro código. Cada turno tiene como
 * máximo un código vigente (generar uno nuevo invalida el anterior).
 */
@Injectable()
export class PairingService {
  private readonly byCode = new Map<string, Pending>();
  private readonly byTicket = new Map<string, string>();

  create(ticketId: string, now = Date.now()): { code: string; expiresAt: Date } {
    this.purge(now);
    const previous = this.byTicket.get(ticketId);
    if (previous) this.byCode.delete(previous);

    let code: string;
    do {
      code = Array.from({ length: PAIRING_CODE_LENGTH }, () =>
        PAIRING_CODE_ALPHABET.charAt(randomInt(PAIRING_CODE_ALPHABET.length)),
      ).join('');
    } while (this.byCode.has(code));

    const expiresAt = now + PAIRING_CODE_TTL_MINUTES * 60_000;
    this.byCode.set(code, { ticketId, expiresAt });
    this.byTicket.set(ticketId, code);
    return { code, expiresAt: new Date(expiresAt) };
  }

  /** Devuelve el turno del código y lo invalida. Lanza si no existe o venció. */
  redeem(raw: string, now = Date.now()): string {
    this.purge(now);
    const code = normalizePairingCode(raw);
    const pending = this.byCode.get(code);
    if (!pending)
      throw new UnauthorizedException('El código no es válido o venció: pedile uno nuevo al personal');
    this.byCode.delete(code);
    this.byTicket.delete(pending.ticketId);
    return pending.ticketId;
  }

  private purge(now: number): void {
    for (const [code, p] of this.byCode) {
      if (p.expiresAt <= now) {
        this.byCode.delete(code);
        if (this.byTicket.get(p.ticketId) === code) this.byTicket.delete(p.ticketId);
      }
    }
  }
}
