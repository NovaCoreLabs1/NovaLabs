import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../users/entities/user.entity';
import { SetupPinDto } from '../dto/setup-pin.dto';
import { ChangePinDto } from '../dto/change-pin.dto';
import {
  AuthenticatedCheckInDto,
  CheckInAuthMethod,
} from '../dto/authenticated-check-in.dto';
import { verifySync } from 'otplib';

@Injectable()
export class CheckInAuthProvider {
  private readonly SALT_ROUNDS = 10;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Sets up a new check-in PIN for the user.
   * @param userId - UUID of the user
   * @param dto - PIN setup data with pin and confirmPin
   * @throws BadRequestException if PINs don't match or PIN already exists
   */
  async setupPin(userId: string, dto: SetupPinDto): Promise<{ success: boolean }> {
    if (dto.pin !== dto.confirmPin) {
      throw new BadRequestException('PINs do not match');
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.checkInPin) {
      throw new BadRequestException(
        'PIN already set. Use change PIN endpoint to update.',
      );
    }

    const hashedPin = await bcrypt.hash(dto.pin, this.SALT_ROUNDS);
    await this.usersRepository.update(userId, { checkInPin: hashedPin });

    return { success: true };
  }

  /**
   * Changes an existing check-in PIN.
   * Requires current PIN and optional 2FA verification if enabled.
   * @param userId - UUID of the user
   * @param dto - Change PIN data
   * @throws UnauthorizedException if current PIN is incorrect or 2FA fails
   * @throws BadRequestException if new PINs don't match
   */
  async changePin(userId: string, dto: ChangePinDto): Promise<{ success: boolean }> {
    if (dto.newPin !== dto.confirmNewPin) {
      throw new BadRequestException('New PINs do not match');
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.checkInPin) {
      throw new BadRequestException('No PIN set. Use setup PIN endpoint first.');
    }

    // Verify current PIN
    const isPinValid = await bcrypt.compare(dto.currentPin, user.checkInPin);
    if (!isPinValid) {
      throw new UnauthorizedException('Current PIN is incorrect');
    }

    // Verify 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!dto.totpCode) {
        throw new BadRequestException('2FA code required');
      }
      const result = verifySync({ token: dto.totpCode, secret: user.totpSecret });
      if (!result?.valid) {
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    const hashedPin = await bcrypt.hash(dto.newPin, this.SALT_ROUNDS);
    await this.usersRepository.update(userId, { checkInPin: hashedPin });

    return { success: true };
  }

  /**
   * Removes the check-in PIN for a user.
   * Requires current PIN verification.
   * @param userId - UUID of the user
   * @param currentPin - Current PIN to verify
   */
  async removePin(userId: string, currentPin: string): Promise<{ success: boolean }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user || !user.checkInPin) {
      throw new BadRequestException('No PIN set');
    }

    const isPinValid = await bcrypt.compare(currentPin, user.checkInPin);
    if (!isPinValid) {
      throw new UnauthorizedException('PIN is incorrect');
    }

    await this.usersRepository.update(userId, { checkInPin: null });

    return { success: true };
  }

  /**
   * Verifies the authentication for check-in.
   * @param userId - UUID of the user
   * @param dto - Check-in data with auth method and credentials
   * @returns The validated auth method to be stored in the log
   * @throws UnauthorizedException if authentication fails
   */
  async verifyCheckInAuth(
    userId: string,
    dto: AuthenticatedCheckInDto,
  ): Promise<CheckInAuthMethod> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    switch (dto.authMethod) {
      case CheckInAuthMethod.PIN:
        return this.verifyPinAuth(user, dto.pin);

      case CheckInAuthMethod.BIOMETRIC:
        return this.verifyBiometricAuth(user, dto.biometricAssertion);

      case CheckInAuthMethod.NONE:
        // Allow check-in without auth if user has no PIN/biometric set up
        if (!user.checkInPin && !user.biometricEnabled) {
          return CheckInAuthMethod.NONE;
        }
        // If user has auth set up, require it
        throw new UnauthorizedException(
          'Authentication required. Please use PIN or biometric.',
        );

      default:
        throw new BadRequestException('Invalid authentication method');
    }
  }

  /**
   * Verifies PIN authentication.
   */
  private async verifyPinAuth(
    user: User,
    pin?: string,
  ): Promise<CheckInAuthMethod> {
    if (!pin) {
      throw new BadRequestException('PIN is required');
    }

    if (!user.checkInPin) {
      throw new BadRequestException('No PIN set up for this account');
    }

    const isPinValid = await bcrypt.compare(pin, user.checkInPin);
    if (!isPinValid) {
      throw new UnauthorizedException('Invalid PIN');
    }

    return CheckInAuthMethod.PIN;
  }

  /**
   * Verifies biometric (WebAuthn) authentication.
   * For now, this is a placeholder - full WebAuthn implementation would require
   * additional infrastructure (challenge generation, credential verification).
   */
  private async verifyBiometricAuth(
    user: User,
    assertion?: string,
  ): Promise<CheckInAuthMethod> {
    if (!assertion) {
      throw new BadRequestException('Biometric assertion is required');
    }

    if (!user.biometricEnabled || !user.webAuthnCredentials?.length) {
      throw new BadRequestException('Biometric not set up for this account');
    }

    // TODO: Implement full WebAuthn verification
    // For now, we accept the assertion if biometric is enabled
    // In production, you would:
    // 1. Parse the assertion
    // 2. Verify the signature against stored public key
    // 3. Verify the challenge matches the one generated
    // 4. Check counter to prevent replay attacks

    return CheckInAuthMethod.BIOMETRIC;
  }

  /**
   * Checks if a user has PIN authentication set up.
   */
  async hasPinSetup(userId: string): Promise<boolean> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'checkInPin'],
    });
    return !!user?.checkInPin;
  }

  /**
   * Checks if a user has biometric authentication set up.
   */
  async hasBiometricSetup(userId: string): Promise<boolean> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'biometricEnabled', 'webAuthnCredentials'],
    });
    return !!user?.biometricEnabled && !!user?.webAuthnCredentials?.length;
  }

  /**
   * Gets the authentication status for a user.
   */
  async getAuthStatus(userId: string): Promise<{
    hasPinSetup: boolean;
    hasBiometricSetup: boolean;
    requiresAuth: boolean;
  }> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'checkInPin', 'biometricEnabled', 'webAuthnCredentials'],
    });

    const hasPinSetup = !!user?.checkInPin;
    const hasBiometricSetup = !!user?.biometricEnabled && !!user?.webAuthnCredentials?.length;

    return {
      hasPinSetup,
      hasBiometricSetup,
      requiresAuth: hasPinSetup || hasBiometricSetup,
    };
  }
}
