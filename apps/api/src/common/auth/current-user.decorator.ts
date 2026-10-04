import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from './auth-user';

/** Inyecta el usuario autenticado: `@CurrentUser() user: AuthUser`. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
