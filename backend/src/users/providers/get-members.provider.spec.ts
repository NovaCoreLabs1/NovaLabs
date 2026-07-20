import { Test, TestingModule } from '@nestjs/testing';
import { GetMembersProvider } from './get-members.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { MembershipStatus } from '../enums/membership-status.enum';

describe('GetMembersProvider', () => {
  let provider: GetMembersProvider;
  let usersRepository: any;

  beforeEach(async () => {
    usersRepository = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetMembersProvider,
        { provide: getRepositoryToken(User), useValue: usersRepository },
      ],
    }).compile();

    provider = module.get<GetMembersProvider>(GetMembersProvider);
  });

  function mockQueryBuilder(overrides: any = {}) {
    const qb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(overrides.total ?? 0),
      getMany: jest.fn().mockResolvedValue(overrides.data ?? []),
    };
    usersRepository.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getMembers', () => {
    it('returns paginated members with default pagination', async () => {
      const qb = mockQueryBuilder({
        total: 1,
        data: [
          { id: 'member-1', firstname: 'Alice', email: 'alice@example.com' },
        ],
      });

      const result = await provider.getMembers({});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(qb.select).toHaveBeenCalled();
      expect(qb.where).toHaveBeenCalledWith('user.isDeleted = :isDeleted', {
        isDeleted: false,
      });
    });

    it('filters by membership status', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.getMembers({ status: MembershipStatus.ACTIVE });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'user.membershipStatus = :status',
        { status: MembershipStatus.ACTIVE },
      );
    });

    it('filters by search term', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.getMembers({ search: 'alice' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(LOWER(user.firstname) LIKE :search OR LOWER(user.lastname) LIKE :search OR LOWER(user.email) LIKE :search)',
        { search: '%alice%' },
      );
    });

    it('applies pagination parameters', async () => {
      const qb = mockQueryBuilder({ total: 50, data: [] });

      const result = await provider.getMembers({ page: 3, limit: 10 });

      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result.totalPages).toBe(5);
    });

    it('returns empty result when no members match', async () => {
      mockQueryBuilder({ total: 0, data: [] });

      const result = await provider.getMembers({ search: 'nonexistent' });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });
});
