import { Test, TestingModule } from '@nestjs/testing';
import { ListNewsletterSubscribersProvider } from './list-subscribers.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NewsletterSubscriber } from '../entities/newsletter.entity';

describe('ListNewsletterSubscribersProvider', () => {
  let provider: ListNewsletterSubscribersProvider;
  let repo: any;

  beforeEach(async () => {
    repo = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListNewsletterSubscribersProvider,
        {
          provide: getRepositoryToken(NewsletterSubscriber),
          useValue: repo,
        },
      ],
    }).compile();

    provider = module.get<ListNewsletterSubscribersProvider>(
      ListNewsletterSubscribersProvider,
    );
  });

  function mockQb(overrides: { rows?: any[]; total?: number } = {}) {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest
        .fn()
        .mockResolvedValue([overrides.rows ?? [], overrides.total ?? 0]),
    };
    repo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('execute', () => {
    it('returns paginated subscribers with defaults', async () => {
      const qb = mockQb({
        rows: [
          {
            id: 'sub-1',
            email: 'alice@example.com',
            subscribedAt: new Date(),
            isActive: true,
            isVerified: true,
            verifiedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      });

      const result = await provider.execute({});

      expect(result.items).toHaveLength(1);
      expect(result.meta.totalItems).toBe(1);
      expect(result.meta.currentPage).toBe(1);
      expect(result.meta.itemsPerPage).toBe(10);
      expect(result.meta.totalPages).toBe(1);
      expect(qb.where).toHaveBeenCalledWith('s.deletedAt IS NULL');
    });

    it('applies search filter', async () => {
      const qb = mockQb({ rows: [], total: 0 });

      await provider.execute({ searchTerm: 'alice' });

      expect(qb.andWhere).toHaveBeenCalledWith('LOWER(s.email) LIKE :email', {
        email: '%alice%',
      });
    });

    it('filters by active status', async () => {
      const qb = mockQb({ rows: [], total: 0 });

      await provider.execute({ category: 'active' });

      expect(qb.andWhere).toHaveBeenCalledWith('s.isActive = true');
    });

    it('filters by inactive status', async () => {
      const qb = mockQb({ rows: [], total: 0 });

      await provider.execute({ category: 'inactive' });

      expect(qb.andWhere).toHaveBeenCalledWith('s.isActive = false');
    });

    it('filters by verified status', async () => {
      const qb = mockQb({ rows: [], total: 0 });

      await provider.execute({ category: 'verified' });

      expect(qb.andWhere).toHaveBeenCalledWith('s.isVerified = true');
    });

    it('filters by pending (unverified) status', async () => {
      const qb = mockQb({ rows: [], total: 0 });

      await provider.execute({ category: 'pending' });

      expect(qb.andWhere).toHaveBeenCalledWith('s.isVerified = false');
    });

    it('applies custom pagination', async () => {
      const qb = mockQb({ rows: [], total: 25 });

      const result = await provider.execute({ page: 2, perPage: 10 });

      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result.meta.currentPage).toBe(2);
      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.hasPreviousPage).toBe(true);
    });

    it('computes hasPreviousPage as false on first page', async () => {
      mockQb({ rows: [], total: 25 });

      const result = await provider.execute({ page: 1, perPage: 10 });

      expect(result.meta.hasPreviousPage).toBe(false);
      expect(result.meta.hasNextPage).toBe(true);
    });
  });
});
