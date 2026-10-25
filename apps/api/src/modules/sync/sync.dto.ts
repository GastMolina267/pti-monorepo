import { ApiProperty } from '@nestjs/swagger';
import type { SyncStatus } from '@vitalia/contracts';

export class SyncStatusDto implements SyncStatus {
  @ApiProperty() enabled!: boolean;
  @ApiProperty({ example: 'gateway-local' }) gatewayId!: string;
  @ApiProperty() pending!: number;
  @ApiProperty({ nullable: true, type: String }) lastSuccessAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) lastError!: string | null;
  @ApiProperty() consecutiveFailures!: number;
  @ApiProperty({ nullable: true, type: String }) nextAttemptAt!: string | null;
}
