import { IsString, Length, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChangePinDto {
  @ApiProperty({ description: 'Current PIN', example: '1234' })
  @IsString()
  @Length(4, 4, { message: 'PIN must be exactly 4 digits' })
  @Matches(/^\d{4}$/, { message: 'PIN must contain only digits' })
  currentPin: string;

  @ApiProperty({ description: 'New 4-digit PIN', example: '5678' })
  @IsString()
  @Length(4, 4, { message: 'PIN must be exactly 4 digits' })
  @Matches(/^\d{4}$/, { message: 'PIN must contain only digits' })
  newPin: string;

  @ApiProperty({ description: 'Confirm the new PIN', example: '5678' })
  @IsString()
  @Length(4, 4, { message: 'PIN must be exactly 4 digits' })
  @Matches(/^\d{4}$/, { message: 'PIN must contain only digits' })
  confirmNewPin: string;

  @ApiPropertyOptional({ description: '2FA code if enabled', example: '123456' })
  @IsOptional()
  @IsString()
  @Length(6, 6, { message: 'TOTP code must be 6 digits' })
  totpCode?: string;
}
