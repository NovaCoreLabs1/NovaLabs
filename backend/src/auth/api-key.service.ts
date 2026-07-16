import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { ApiKeyEntity, ApiKeyScope } from './entities/api-key.entity';

const BCRYPT_ROUNDS = 12;
const KEY_BYTES = 32; // 256-bit raw key → 64-char hex string

export interface CreateApiKeyDto {
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: Date;
}

export interface CreatedApiKey {
  /** The full raw key — shown ONCE to the caller. Never stored. */
  rawKey: string;
  entity: ApiKeyEntity;
}

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly repo: Repository<ApiKeyEntity>,
  ) {}

  /**
   * Generate a new API key.
   * Returns the raw key exactly once — it cannot be recovered afterwards.
   */
  async create(dto: CreateApiKeyDto): Promise<CreatedApiKey> {
    // Generate a cryptographically-secure random key
    const rawKey = crypto.randomBytes(KEY_BYTES).toString('hex');

    // Prefix = first 8 chars (used for fast DB lookup)
    const prefix = rawKey.substring(0, 8);

    // Hash the full key for storage
    const hash = await bcrypt.hash(rawKey, BCRYPT_ROUNDS);

    const entity = this.repo.create({
      name: dto.name,
      prefix,
      hash,
      scopes: dto.scopes,
      expiresAt: dto.expiresAt ?? null,
      revoked: false,
    });

    await this.repo.save(entity);

    return { rawKey, entity };
  }

  /** Soft-revoke a key by ID. */
  async revoke(id: string): Promise<ApiKeyEntity> {
    const key = await this.repo.findOne({ where: { id } });
    if (!key) throw new NotFoundException(`API key ${id} not found`);

    key.revoked = true;
    return this.repo.save(key);
  }

  /** List all keys (hashes are never returned in listings). */
  async findAll(): Promise<Omit<ApiKeyEntity, 'hash'>[]> {
    const keys = await this.repo.find({
      select: ['id', 'name', 'prefix', 'scopes', 'expiresAt', 'revoked', 'createdAt', 'updatedAt'],
    });
    return keys;
  }
}