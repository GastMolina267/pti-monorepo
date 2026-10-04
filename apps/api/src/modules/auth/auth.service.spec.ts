import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { hashSync } from 'bcryptjs';
import type { Repository } from 'typeorm';
import type { Env } from '../../config/env.schema';
import { AuthService } from './auth.service';
import type { StaffUserEntity } from './entities/staff-user.entity';

const user = {
  id: 'u-1',
  email: 'medico@vitalia.local',
  fullName: 'Dra. Fernández',
  role: 'DOCTOR',
  active: true,
  passwordHash: hashSync('Vitalia2026!', 4),
} as StaffUserEntity;

function build(found: StaffUserEntity | null) {
  const qb = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(found),
  };
  const repo = { createQueryBuilder: jest.fn(() => qb) } as unknown as Repository<StaffUserEntity>;
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt') } as unknown as JwtService;
  const config = { get: jest.fn().mockReturnValue(28800) } as unknown as ConfigService<Env, true>;
  return { service: new AuthService(repo, jwt, config), jwt };
}

describe('AuthService.login', () => {
  it('devuelve token y usuario con credenciales válidas', async () => {
    const { service, jwt } = build(user);
    const res = await service.login({ email: 'MEDICO@vitalia.local', password: 'Vitalia2026!' });
    expect(res).toEqual({
      accessToken: 'signed.jwt',
      expiresIn: 28800,
      user: { id: 'u-1', email: 'medico@vitalia.local', fullName: 'Dra. Fernández', role: 'DOCTOR' },
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'u-1',
      email: user.email,
      name: user.fullName,
      role: 'DOCTOR',
    });
  });

  it('rechaza una contraseña incorrecta', async () => {
    await expect(build(user).service.login({ email: user.email, password: 'otra-clave' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza usuarios inexistentes o inactivos con el mismo mensaje', async () => {
    await expect(build(null).service.login({ email: 'x@y.z', password: '123456' })).rejects.toThrow(
      'Email o contraseña incorrectos',
    );
    await expect(
      build({ ...user, active: false } as StaffUserEntity).service.login({
        email: user.email,
        password: 'Vitalia2026!',
      }),
    ).rejects.toThrow('Email o contraseña incorrectos');
  });
});
