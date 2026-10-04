import { ApiProperty } from '@nestjs/swagger';
import type { HealthCheck, HealthResponse, ServiceStatus } from '@vitalia/contracts';

const STATUSES: ServiceStatus[] = ['ok', 'degraded', 'down'];

export class HealthCheckDto implements HealthCheck {
  @ApiProperty({ example: 'process' }) name!: string;
  @ApiProperty({ enum: STATUSES }) status!: ServiceStatus;
  @ApiProperty({ required: false }) detail?: string;
}

/** Documentación Swagger del contrato `HealthResponse` de @vitalia/contracts. */
export class HealthResponseDto implements HealthResponse {
  @ApiProperty({ enum: STATUSES, example: 'ok' }) status!: ServiceStatus;
  @ApiProperty({ example: 'vitalia-api' }) service!: 'vitalia-api';
  @ApiProperty({ example: '0.1.0' }) version!: string;
  @ApiProperty({ example: 'development' }) environment!: string;
  @ApiProperty({ example: 42 }) uptimeSeconds!: number;
  @ApiProperty({ example: '2026-10-03T22:00:00.000Z' }) timestamp!: string;
  @ApiProperty({ type: [HealthCheckDto] }) checks!: HealthCheckDto[];
}
