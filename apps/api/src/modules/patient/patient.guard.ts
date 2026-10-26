import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PatientSessionService, type PatientPrincipal } from './patient-session.service';

type PatientRequest = { headers: Record<string, string | undefined>; patient?: PatientPrincipal };

/**
 * Guard de `/api/patient/*`. Esos endpoints son `@Public()` para el guard del personal y
 * exigen acá la sesión de turno (`Authorization: Bearer <token del paciente>`).
 */
@Injectable()
export class PatientGuard implements CanActivate {
  constructor(private readonly sessions: PatientSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PatientRequest>();
    const [scheme, token] = (request.headers['authorization'] ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Falta la sesión del paciente');
    request.patient = await this.sessions.verify(token);
    return true;
  }
}

/** `@CurrentPatient() p: PatientPrincipal` en handlers protegidos con {@link PatientGuard}. */
export const CurrentPatient = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): PatientPrincipal =>
    ctx.switchToHttp().getRequest<Required<PatientRequest>>().patient,
);
