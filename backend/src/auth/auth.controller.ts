import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtAuthGuard } from './guard/jwt.auth.guard';
import { RolesGuard } from './guard/roles.guard';
import { Roles } from './decorators/roles.decorators';
import { UserRole } from '../users/enums/userRoles.enum';
import { User } from '../users/entities/user.entity';
import { CurrentUser } from './decorators/current.user.decorators';
import { GetCurrentUser } from './decorators/getCurrentUser.decorator';
import { Public } from './decorators/public.decorator';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { SendPasswordResetOtpDto } from './dto/send-password-reset-otp.dto';
import { Setup2faDto } from './dto/setup-2fa.dto';
import { VerifyTotpDto } from './dto/verify-totp.dto';
import { UseBackupCodeDto } from './dto/use-backup-code.dto';
import { Disable2faDto } from './dto/disable-2fa.dto';

const isProduction = process.env.NODE_ENV === 'production';

function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken?: string,
) {
  res.cookie('authAccessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 1 day
  });
  if (refreshToken) {
    res.cookie('authRefreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth/refresh-token',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  }
}

function clearAuthCookies(res: Response) {
  res.cookie('authAccessToken', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  res.cookie('authRefreshToken', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/auth/refresh-token',
    maxAge: 0,
  });
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Registers a new member account.
   * Sends an OTP verification email after successful registration.
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createUserDto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.createUser(createUserDto);
    if (result.accessToken) {
      setAuthCookies(res, result.accessToken);
    }
    return result;
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() verifyOtpDto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyOtp(verifyOtpDto);
    if (result.tokens?.accessToken) {
      setAuthCookies(
        res,
        result.tokens.accessToken,
        result.tokens.refreshToken,
      );
    }
    return result;
  }
  @Public()
  @Post('resend-verification-otp')
  @HttpCode(HttpStatus.OK)
  resendVerificationOtp(@Body() resendOtpDto: ResendOtpDto) {
    return this.authService.resendVerificationOtp(resendOtpDto.email);
  }

  @Post('register-admin')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  createAdmin(@Body() createUserDto: CreateUserDto) {
    return this.authService.createAdminUser(createUserDto);
  }
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginUserDto: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginUserDto);
    if (result && 'accessToken' in result) {
      setAuthCookies(res, result.accessToken, result.refreshToken);
    }
    return result;
  }
  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body('refreshToken') refreshToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refreshToken(refreshToken);
    if (result.accessToken) {
      setAuthCookies(res, result.accessToken, result.refreshToken);
    }
    return result;
  }

  @Get('current-user')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  retrieveCurrentUser(@CurrentUser() user: User) {
    return user;
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() sendPasswordResetOtpDto: SendPasswordResetOtpDto) {
    return this.authService.requestResetPasswordOtp(sendPasswordResetOtpDto);
  }

  @Public()
  @Post('send-reset-password-otp')
  @HttpCode(HttpStatus.OK)
  requestResetPasswordOtp(
    @Body() sendPasswordResetOtpDto: SendPasswordResetOtpDto,
  ) {
    return this.authService.requestResetPasswordOtp(sendPasswordResetOtpDto);
  }
  @Public()
  @Post('resend-reset-password-otp')
  @HttpCode(HttpStatus.OK)
  resendResetPasswordVerificationOtp(@Body() resendOtpDto: ResendOtpDto) {
    return this.authService.resendResetPasswordVerificationOtp(resendOtpDto);
  }

  @Public()
  @Post('verify-reset-password-otp')
  @HttpCode(HttpStatus.OK)
  verifyResetPasswordOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyResetPasswordOtp(verifyOtpDto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  setup2fa(@GetCurrentUser('id') userId: string) {
    return this.authService.setup2fa(userId);
  }

  @Post('2fa/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  confirm2fa(@GetCurrentUser('id') userId: string, @Body() dto: Setup2faDto) {
    return this.authService.confirm2fa(userId, dto);
  }

  @Public()
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyTotpLogin(
    @Body() dto: VerifyTotpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyTotpLogin(dto);
    if (result.accessToken) {
      setAuthCookies(res, result.accessToken, result.refreshToken);
    }
    return result;
  }

  @Public()
  @Post('2fa/backup-code')
  @HttpCode(HttpStatus.OK)
  async verifyBackupCode(
    @Body() dto: UseBackupCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyBackupCode(dto);
    if (result.accessToken) {
      setAuthCookies(res, result.accessToken, result.refreshToken);
    }
    return result;
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  disable2fa(@GetCurrentUser('id') userId: string, @Body() dto: Disable2faDto) {
    return this.authService.disable2fa(userId, dto);
  }

  @Get('2fa/status')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  get2faStatus(@GetCurrentUser('id') userId: string) {
    return this.authService.get2faStatus(userId);
  }
}
