/** Roles del personal de salud (Backoffice). */
export const STAFF_ROLES = ['ADMIN', 'NURSE', 'DOCTOR', 'RECEPTION'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: 'Administración',
  NURSE: 'Enfermería / Triaje',
  DOCTOR: 'Médico/a',
  RECEPTION: 'Recepción',
};

export interface StaffUser {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
}

/** `POST /api/auth/login` */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  /** JWT para el header `Authorization: Bearer <token>`. */
  accessToken: string;
  /** Segundos hasta que expira el token. */
  expiresIn: number;
  user: StaffUser;
}

/** Roles que pueden llamar turnos a consultorio. */
export const ROLES_CAN_CALL: readonly StaffRole[] = ['DOCTOR', 'NURSE', 'ADMIN'];
/** Roles que pueden cambiar el nivel de triaje manualmente. */
export const ROLES_CAN_TRIAGE: readonly StaffRole[] = ['NURSE', 'DOCTOR', 'ADMIN'];
