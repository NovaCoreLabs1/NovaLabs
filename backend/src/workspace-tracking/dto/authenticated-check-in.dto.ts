import { IsOptional, IsString, IsUUID, IsEnum, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CheckInAuthMethod {
  BIOMETRIC = 'biometric',
  PIN = 'pin',
  NONE = 'none',
}

export class AuthenticatedCheckInDto {
  @ApiProperty({ description: 'Workspace to check into' })
  @IsUUID()
  workspaceId: string;

  @ApiPropertyOptional({ description: 'Associated booking ID (optional)' })
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Authentication method used', enum: CheckInAuthMethod })
  @IsEnum(CheckInAuthMethod)
  authMethod: CheckInAuthMethod;

  @ApiPropertyOptional({ description: '4-digit PIN if using PIN auth', example: '1234' })
  @IsOptional()
  @IsString()
  @Length(4, 4, { message: 'PIN must be exactly 4 digits' })
  @Matches(/^\d{4}$/, { message: 'PIN must contain only digits' })
  pin?: string;

  @ApiPropertyOptional({ description: 'WebAuthn assertion response for biometric auth' })
  @IsOptional()
  @IsString()
  biometricAssertion?: string;
}
