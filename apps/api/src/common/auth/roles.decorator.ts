import { SetMetadata } from '@nestjs/common';
import type { StaffRole } from '@vitalia/contracts';

export const ROLES_KEY = 'roles';

/** Restringe un endpoint a ciertos roles del personal (además de exigir JWT). */
export const Roles = (...roles: readonly StaffRole[]) => SetMetadata(ROLES_KEY, roles);
