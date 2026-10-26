import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PATIENT_SESSION_HOURS } from '@vitalia/contracts';
import { PatientSessionService } from './patient-session.service';

const JWT_SECRET = 'x'.repeat(48);
const config = { get: (key: string) => (key === 'JWT_SECRET' ? JWT_SECRET : undefined) };

describe('PatientSessionService', () => {
  const staffJwt = new JwtService({ secret: JWT_SECRET });
  const sessions = new PatientSessionService(staffJwt, config as never);

  it('emite una sesión de 24 h que solo valida como paciente', async () => {
    const now = new Date('2026-10-25T15:00:00Z');
    const session = await sessions.issue('ticket-1', 'patient-1', now);
    expect(session.ticketId).toBe('ticket-1');
    expect(Date.parse(session.expiresAt) - now.getTime()).toBe(PATIENT_SESSION_HOURS * 3_600_000);
    await expect(sessions.verify(session.token)).resolves.toEqual({
      ticketId: 'ticket-1',
      patientId: 'patient-1',
    });

    // El guard del personal (JWT_SECRET) no la acepta
    await expect(staffJwt.verifyAsync(session.token)).rejects.toThrow();
  });

  it('rechaza tokens del personal, alterados o vencidos', async () => {
    const staffToken = await staffJwt.signAsync({ sub: 'u1', role: 'ADMIN' });
    await expect(sessions.verify(staffToken)).rejects.toThrow(UnauthorizedException);

    const { token } = await sessions.issue('ticket-1', 'patient-1');
    await expect(sessions.verify(`${token.slice(0, -2)}xx`)).rejects.toThrow('vinculá la app otra vez');

    const expired = await staffJwt.signAsync(
      { sub: 'ticket-1', pid: 'patient-1', typ: 'patient' },
      {
        secret: (sessions as unknown as { secret: string }).secret,
        audience: 'vitalia-patient',
        expiresIn: -10,
      },
    );
    await expect(sessions.verify(expired)).rejects.toThrow(UnauthorizedException);
  });
});
