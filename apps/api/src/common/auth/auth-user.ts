import type { StaffRole } from '@vitalia/contracts';

/** Usuario autenticado que el JwtAuthGuard deja en `request.user`. */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
}

/** Payload firmado en el JWT. */
export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: StaffRole;
}
