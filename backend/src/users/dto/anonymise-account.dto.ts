import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Optional DTO body for `DELETE /users/me` (GDPR Art. 17 right-to-be-forgotten).
 *
 * The endpoint is a no-body controller route, but we accept an optional
 * `reason` string for analytics on why users leave (never stored in plain text
 * on the User row — only echoed into the audit_log metadata if provided).
 */
export class AnonymiseAccountDto {
  @ApiProperty({
    description:
      'Optional, ephemeral reason for the deletion request. Only used for aggregate analytics via audit_log metadata; never persisted on the user record.',
    required: false,
    maxLength: 280,
  })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  reason?: string;
}
