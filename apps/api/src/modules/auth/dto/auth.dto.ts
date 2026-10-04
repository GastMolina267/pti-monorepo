import { ApiProperty } from '@nestjs/swagger';
import {
  STAFF_ROLES,
  type LoginRequest,
  type LoginResponse,
  type StaffRole,
  type StaffUser,
} from '@vitalia/contracts';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto implements LoginRequest {
  @ApiProperty({ example: 'enfermeria@vitalia.local' })
  @IsEmail({}, { message: 'Ingresá un email válido' })
  email!: string;

  @ApiProperty({ example: 'Vitalia2026!' })
  @IsString({ message: 'Ingresá tu contraseña' })
  @MinLength(6, { message: 'La contraseña tiene al menos 6 caracteres' })
  @MaxLength(100)
  password!: string;
}

export class StaffUserDto implements StaffUser {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ enum: STAFF_ROLES }) role!: StaffRole;
}

export class LoginResponseDto implements LoginResponse {
  @ApiProperty() accessToken!: string;
  @ApiProperty({ example: 28800 }) expiresIn!: number;
  @ApiProperty({ type: StaffUserDto }) user!: StaffUserDto;
}
