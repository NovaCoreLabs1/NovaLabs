import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { TrustedDevice } from '../entities/trusted-device.entity';
import { User } from '../../users/entities/user.entity';

/** Cookie name written to the browser */
export const TRUSTED_DEVICE_COOKIE = 'td_token';

/** How many days a trusted-device token remains valid */
const TRUST_DAYS = 30;

/** bcrypt cost factor — low enough to be fast, high enough to resist offline attacks */
const BCRYPT_ROUNDS = 10;

/**
 * TrustedDeviceService — Issue #120
 *
 * Handles creation, validation, and revocation of trusted-device tokens.
 * A 30-day secure cookie carries the raw random token; only its bcrypt
 * hash is persisted in the database.
 */
@Injectable()
export class TrustedDeviceService {
  constructor(
    @InjectRepository(TrustedDevice)
    private readonly trustedDeviceRepo: Repository<TrustedDevice>,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Issue a new trusted-device token for a user.
   * @returns The raw (unhashed) token to write into the `td_token` cookie.
   */
  async createTrustedDevice(
    user: User,
    deviceLabel = 'Unknown device',
  ): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const hash = await bcrypt.hash(rawToken, BCRYPT_ROUNDS);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TRUST_DAYS);

    await this.trustedDeviceRepo.save(
      this.trustedDeviceRepo.create({
        user,
        deviceToken: hash,
        deviceLabel,
        expiresAt,
      }),
    );

    return rawToken;
  }

  /**
   * Check whether a raw token is a valid, unexpired trusted-device record
   * for the given user. Expired records are pruned lazily on lookup.
   */
  async isTrustedDevice(user: User, rawToken: string): Promise<boolean> {
    await this.pruneExpired(user);

    const records = await this.trustedDeviceRepo.find({
      where: { user: { id: user.id } },
    });

    for (const record of records) {
      if (record.expiresAt < new Date()) continue;
      const match = await bcrypt.compare(rawToken, record.deviceToken);
      if (match) return true;
    }

    return false;
  }

  /**
   * Return all unexpired trusted devices for a user (for the settings UI).
   */
  async listTrustedDevices(
    user: User,
  ): Promise<Omit<TrustedDevice, 'deviceToken'>[]> {
    await this.pruneExpired(user);
    return this.trustedDeviceRepo.find({
      where: { user: { id: user.id } },
      select: ['id', 'deviceLabel', 'expiresAt', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Revoke a specific trusted device by ID (user must own it).
   */
  async revokeTrustedDevice(user: User, deviceId: string): Promise<void> {
    const record = await this.trustedDeviceRepo.findOne({
      where: { id: deviceId },
      relations: ['user'],
    });

    if (!record) {
      throw new NotFoundException('Trusted device not found.');
    }

    if (record.user.id !== user.id) {
      throw new ForbiddenException('Cannot revoke another user\'s device.');
    }

    await this.trustedDeviceRepo.remove(record);
  }

  /**
   * Revoke ALL trusted devices for a user (e.g. on password change or
   * suspicious activity detection).
   */
  async revokeAllTrustedDevices(user: User): Promise<number> {
    const records = await this.trustedDeviceRepo.find({
      where: { user: { id: user.id } },
    });
    await this.trustedDeviceRepo.remove(records);
    return records.length;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async pruneExpired(user: User): Promise<void> {
    await this.trustedDeviceRepo.delete({
      user: { id: user.id },
      expiresAt: LessThan(new Date()),
    });
  }
}
