import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hub } from './entities/hub.entity';

export const DEFAULT_HUB_SLUG = 'default';

/**
 * Resolves the deployment's default hub and exposes its real UUID as *the*
 * explicit tenant representation for legacy rows.
 *
 * Before issue #225 the tenant context fell back to the literal string
 * `'default'`, which is not a UUID and could never match a `hubId` column.
 * This service replaces that fallback: at boot (`ensureDefaultHub`, called
 * from `main.ts`) it idempotently guarantees a hub row with slug
 * `'default'` exists and caches its UUID. The JWT minting path uses the
 * cached value when a legacy user's `hubId` is NULL, so every access token
 * carries a real hub UUID and any future `WHERE hubId = :hubId` filter
 * behaves predictably.
 *
 * Reads before boot completion return `undefined`; consumers must treat an
 * undefined resolution as "no tenant scope" rather than inventing a value.
 */
@Injectable()
export class DefaultHubService {
  private readonly logger = new Logger(DefaultHubService.name);
  private cachedHubId: string | undefined;

  constructor(
    @InjectRepository(Hub)
    private readonly hubsRepository: Repository<Hub>,
  ) {}

  /**
   * Idempotently creates the default hub if missing, caches its UUID and
   * returns it. Safe to call concurrently; unique-slug races are tolerated
   * by re-reading the existing row.
   */
  async ensureDefaultHub(): Promise<string> {
    const existing = await this.hubsRepository.findOne({
      where: { slug: DEFAULT_HUB_SLUG },
    });
    if (existing) {
      this.cachedHubId = existing.id;
      return existing.id;
    }

    try {
      const created = await this.hubsRepository.save({
        name: 'Default Hub',
        slug: DEFAULT_HUB_SLUG,
        description:
          'Implicit tenant for rows created before explicit hub assignment.',
      });
      this.cachedHubId = created.id;
      this.logger.log(`Created default hub ${created.id}`);
      return created.id;
    } catch (error) {
      // Lost a creation race (unique slug) — fall back to reading the winner.
      const winner = await this.hubsRepository.findOne({
        where: { slug: DEFAULT_HUB_SLUG },
      });
      if (!winner) {
        throw error;
      }
      this.cachedHubId = winner.id;
      return winner.id;
    }
  }

  /** Cached default hub UUID, or `undefined` before boot completed. */
  get defaultHubId(): string | undefined {
    return this.cachedHubId;
  }
}
