import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../decorators/public.decorator';
import { GetCurrentUser } from '../decorators/getCurrentUser.decorator';
import { JwtAuthGuard } from '../guard/jwt.auth.guard';
import { PasskeyService } from './passkey.service';

@Controller('auth/passkey')
export class PasskeyController {
  constructor(private readonly passkeyService: PasskeyService) {}

  @Post('register/options')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async createRegistrationOptions(@GetCurrentUser('id') userId: string) {
    return this.passkeyService.createRegistrationOptions(userId);
  }

  @Post('register/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async verifyRegistrationResponse(
    @GetCurrentUser('id') userId: string,
    @Body() body: { response: any },
  ) {
    return this.passkeyService.verifyRegistrationResponse(
      userId,
      body.response,
    );
  }

  @Public()
  @Post('assertion/options')
  @HttpCode(HttpStatus.OK)
  async createAssertionOptions(@Body() body: { email: string }) {
    return this.passkeyService.createAssertionOptions(body.email);
  }

  @Public()
  @Post('assertion/verify')
  @HttpCode(HttpStatus.OK)
  async verifyAssertionResponse(
    @Body() body: { email: string; response: any },
  ) {
    return this.passkeyService.verifyAssertionResponse(
      body.email,
      body.response,
    );
  }
}
