import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  MinLength,
} from 'class-validator';

export class LoginUserDto {
  @IsEmail({}, { message: 'Please provide a valid email' })
  email: string;

  @IsNotEmpty({ message: 'password can not be empty' })
  @MinLength(8, { message: 'password must be at least 8 character long' })
  password: string;

  /**
   * Optional "remember me" flag forwarded by the login UI. Declared so the
   * frontend hook (`frontend/hooks/use-login.ts`) can pass the value through
   * the global ValidationPipe (which is configured with
   * `forbidNonWhitelisted: true` in `main.ts`). The current auth service
   * treats the field as advisory only; honoring it (longer-lived refresh
   * cookie, etc.) is a separate, opt-in change.
   */
  @IsOptional()
  @IsBoolean({ message: 'rememberMe must be a boolean' })
  rememberMe?: boolean;
}
