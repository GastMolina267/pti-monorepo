import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

const ctx = (role?: string) =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  const reflector = new Reflector();

  it('deja pasar si el endpoint no declara roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(new RolesGuard(reflector).canActivate(ctx('RECEPTION'))).toBe(true);
  });

  it('exige uno de los roles declarados', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['DOCTOR', 'NURSE']);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(ctx('DOCTOR'))).toBe(true);
    expect(() => guard.canActivate(ctx('RECEPTION'))).toThrow(ForbiddenException);
  });
});
