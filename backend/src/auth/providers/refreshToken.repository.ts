import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from '../entities/refreshToken.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class RefreshTokenRepositoryOperations {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly repo: Repository<RefreshToken>,
  ) {}

  async createRefreshToken(
    user: User,
    token: string,
    familyId: string,
    version: number,
  ): Promise<RefreshToken> {
    const expiresAt = this.computeExpiryFromEnv();

    const rt = this.repo.create({
      userId: user.id,
      token,
      familyId,
      version,
      expiresAt,
      revoked: false,
      consumedAt: null,
    });

    return this.repo.save(rt);
  }

  async saveRefreshToken(user: User, token: string): Promise<RefreshToken> {
    const familyId = this.generateFamilyId();
    return this.createRefreshToken(user, token, familyId, 1);
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    return this.repo.findOne({ where: { token } });
  }

  async revokeToken(token: string): Promise<void> {
    await this.repo.update({ token }, { revoked: true });
  }

  async findValidToken(token: string): Promise<RefreshToken | null> {
    const rt = await this.findByToken(token);
    if (!rt) return null;
    if (rt.revoked) return null;
    if (rt.consumedAt) return null;
    if (rt.expiresAt && rt.expiresAt < new Date()) return null;
    return rt;
  }

  async markTokenConsumed(token: RefreshToken): Promise<void> {
    await this.repo.update({ id: token.id }, { consumedAt: new Date() });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.repo.update(
      { familyId, revoked: false },
      { revoked: true, consumedAt: new Date() },
    );
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.repo.update({ userId }, { revoked: true });
  }

  private computeExpiryFromEnv(): Date | undefined {
    const raw = process.env.JWT_REFRESH_EXPIRATION;
    if (!raw) return undefined;

    const ms = Number(raw);
    if (Number.isFinite(ms) && ms > 0) {
      return new Date(Date.now() + ms);
    }
    return undefined;
  }

  private generateFamilyId(): string {
    return `fam_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
  }
}
