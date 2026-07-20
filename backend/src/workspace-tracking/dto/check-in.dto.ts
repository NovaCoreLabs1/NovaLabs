import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckInDto {
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

  @ApiPropertyOptional({
    description:
      'Hashed biometric template value; raw biometric data is not permitted',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  biometricTemplateHash?: string;

  @ApiPropertyOptional({
    description:
      'Opaque reference to a biometric template stored outside the database',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  biometricStorageReference?: string;

  @ApiPropertyOptional({
    description: 'Where the biometric template is processed',
    enum: ['local', 'vendor'],
  })
  @IsOptional()
  @IsIn(['local', 'vendor'])
  biometricProcessingLocation?: 'local' | 'vendor';

  @ApiPropertyOptional({
    description: 'Vendor name when templates are kept outside the application',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  biometricVendor?: string;
}
