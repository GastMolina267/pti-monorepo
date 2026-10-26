import { createHmac } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PATIENT_SESSION_HOURS, type PatientSession } from '@vitalia/contracts';
import type { Env } from '../../config/env.schema';

const AUDIENCE = 'vitalia-patient';

/** Lo que el guard deja en el request de `/api/patient/*`. */
export interface PatientPrincipal {
  ticketId: string;
  patientId: string;
}

interface PatientTokenPayload {
  sub: string;
  pid: string;
  typ: 'patient';
}

/**
 * Sesión de turno de la app del paciente (ADR 0019). Se firma con una clave DERIVADA de
 * `JWT_SECRET` (HMAC con un rótulo propio), así un token de paciente nunca valida en el
 * `JwtAuthGuard` del personal ni en el handshake de la sala `staff`, y no hay otro secreto
 * que aprovisionar en el gateway.
 */
@Injectable()
export class PatientSessionService {
  private readonly secret: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.secret = createHmac('sha256', config.get('JWT_SECRET', { infer: true }))
      .update('vitalia:patient-session:v1')
      .digest('base64');
  }

  async issue(ticketId: string, patientId: string, now = new Date()): Promise<PatientSession> {
    const expiresIn = PATIENT_SESSION_HOURS * 3600;
    const payload: PatientTokenPayload = { sub: ticketId, pid: patientId, typ: 'patient' };
    const token = await this.jwt.signAsync(payload, { secret: this.secret, audience: AUDIENCE, expiresIn });
    return { token, ticketId, expiresAt: new Date(now.getTime() + expiresIn * 1000).toISOString() };
  }

  async verify(token: string): Promise<PatientPrincipal> {
    try {
      const p = await this.jwt.verifyAsync<PatientTokenPayload>(token, {
        secret: this.secret,
        audience: AUDIENCE,
      });
      if (p.typ !== 'patient' || !p.sub || !p.pid) throw new Error('typ');
      return { ticketId: p.sub, patientId: p.pid };
    } catch {
      throw new UnauthorizedException('Tu sesión venció o no es válida: vinculá la app otra vez');
    }
  }
}
