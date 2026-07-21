import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { JwtHelper } from '../helper/jwt-helper';
import { UserHelper } from '../helper/user-helper';

@Injectable()
export class PasskeyService {
  private readonly challengeStore = new Map<
    string,
    { challenge: string; email?: string; userId?: string }
  >();

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly jwtHelper: JwtHelper,
    private readonly userHelper: UserHelper,
  ) {}

  private getOrigin() {
    return (
      this.configService.get<string>('WEBAUTHN_ORIGIN') ??
      'http://localhost:3000'
    );
  }

  private getRpId() {
    return this.configService.get<string>('WEBAUTHN_RP_ID') ?? 'localhost';
  }

  async createRegistrationOptions(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const options = await generateRegistrationOptions({
      rpName: 'NovaLabs',
      rpID: this.getRpId(),
      userID: Buffer.from(user.id),
      userName: user.email,
      userDisplayName: user.fullName || user.email,
      timeout: 60000,
      attestationType: 'none',
      authenticatorSelection: {
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    this.challengeStore.set(`register:${user.id}`, {
      challenge: options.challenge,
      userId: user.id,
    });

    return options;
  }

  async verifyRegistrationResponse(userId: string, response: any) {
    const pending = this.challengeStore.get(`register:${userId}`);

    if (!pending?.challenge) {
      throw new BadRequestException('No passkey registration challenge found');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: this.getOrigin(),
      expectedRPID: this.getRpId(),
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new UnauthorizedException('Passkey registration failed');
    }

    const credentials = user.passkeyCredentials ?? [];
    const credentialId = Buffer.from(
      verification.registrationInfo.credential.id,
    ).toString('base64');
    const credentialPublicKey = Buffer.from(
      verification.registrationInfo.credential.publicKey,
    ).toString('base64');

    credentials.push({
      id: credentialId,
      publicKey: credentialPublicKey,
      counter: verification.registrationInfo.credential.counter,
      transports: (response?.response?.transports ?? []).filter(
        (transport: string) => transport,
      ) as any,
      fmt: response?.response?.fmt ?? 'none',
      credentialDeviceType: 'singleDevice',
      credentialBackedUp: false,
    });

    user.passkeyCredentials = credentials;
    await this.userRepository.save(user);

    this.challengeStore.delete(`register:${user.id}`);

    return {
      message: 'Passkey registered successfully',
      user: this.userHelper.formatUserResponse(user),
    };
  }

  async createAssertionOptions(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.passkeyCredentials?.length) {
      throw new BadRequestException('No passkey registered for this account');
    }

    const options = await generateAuthenticationOptions({
      rpID: this.getRpId(),
      userVerification: 'preferred',
      allowCredentials: (user.passkeyCredentials ?? []).map(
        (credential: any) => ({
          id: credential.id,
          transports: credential.transports ?? [],
        }),
      ),
    });

    this.challengeStore.set(`assert:${email}`, {
      challenge: options.challenge,
      email,
    });

    return options;
  }

  async verifyAssertionResponse(email: string, response: any) {
    const pending = this.challengeStore.get(`assert:${email}`);

    if (!pending?.challenge) {
      throw new BadRequestException('No passkey assertion challenge found');
    }

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const matchingCredential = (user.passkeyCredentials ?? []).find(
      (credential: any) => {
        return credential.id === response.id;
      },
    );

    if (!matchingCredential) {
      throw new UnauthorizedException(
        'This passkey is not registered for this account',
      );
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: this.getOrigin(),
      expectedRPID: this.getRpId(),
      credential: {
        id: response.id,
        publicKey: Buffer.from(matchingCredential.publicKey, 'base64'),
        counter: matchingCredential.counter,
        transports: (matchingCredential.transports ?? []).filter(
          (transport: string) => transport,
        ) as any,
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      throw new UnauthorizedException('Passkey assertion failed');
    }

    matchingCredential.counter = verification.authenticationInfo.newCounter;
    await this.userRepository.save(user);
    this.challengeStore.delete(`assert:${email}`);

    const tokens = this.jwtHelper.generateTokens(user);

    return {
      message: 'Passkey authentication successful',
      user: this.userHelper.formatUserResponse(user),
      tokens,
    };
  }
}
