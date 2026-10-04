import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { LoginRequest, LoginResponse, StaffUser } from '@vitalia/contracts';
import { compare } from 'bcryptjs';
import { Repository } from 'typeorm';
import type { AuthUser, JwtPayload } from '../../common/auth/auth-user';
import type { Env } from '../../config/env.schema';
import { StaffUserEntity } from './entities/staff-user.entity';

const INVALID = 'Email o contraseña incorrectos';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(StaffUserEntity) private readonly users: Repository<StaffUserEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login({ email, password }: LoginRequest): Promise<LoginResponse> {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('LOWER(u.email) = LOWER(:email)', { email: email.trim() })
      .getOne();

    // Mismo mensaje para usuario inexistente, inactivo o clave errónea (no revela cuál falló).
    if (!user || !user.active || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException(INVALID);
    }

    const payload: JwtPayload = { sub: user.id, email: user.email, name: user.fullName, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      expiresIn: this.config.get('JWT_EXPIRES_IN_SECONDS', { infer: true }),
      user: toStaffUser(user),
    };
  }

  async me(auth: AuthUser): Promise<StaffUser> {
    const user = await this.users.findOneBy({ id: auth.id, active: true });
    if (!user) throw new UnauthorizedException('Usuario inexistente o inactivo');
    return toStaffUser(user);
  }
}

export function toStaffUser(u: Pick<StaffUserEntity, 'id' | 'email' | 'fullName' | 'role'>): StaffUser {
  return { id: u.id, email: u.email, fullName: u.fullName, role: u.role };
}
