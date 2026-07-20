import { Test, TestingModule } from '@nestjs/testing';
import { GetMemberStatsProvider } from './get-member-stats.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';

describe('GetMemberStatsProvider', () => {
  let provider: GetMemberStatsProvider;
  let usersRepository: any;

  beforeEach(async () => {
    usersRepository = {
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetMemberStatsProvider,
        { provide: getRepositoryToken(User), useValue: usersRepository },
      ],
    }).compile();

    provider = module.get<GetMemberStatsProvider>(GetMemberStatsProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getStats', () => {
    it('returns aggregated member statistics', async () => {
      usersRepository.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(60) // active
        .mockResolvedValueOnce(30) // inactive
        .mockResolvedValueOnce(10) // suspended
        .mockResolvedValueOnce(80); // verified

      const result = await provider.getStats();

      expect(result).toEqual({
        total: 100,
        active: 60,
        inactive: 30,
        suspended: 10,
        verified: 80,
      });
      expect(usersRepository.count).toHaveBeenCalledTimes(5);
    });

    it('returns zeroes when no members exist', async () => {
      usersRepository.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await provider.getStats();

      expect(result).toEqual({
        total: 0,
        active: 0,
        inactive: 0,
        suspended: 0,
        verified: 0,
      });
    });

    it('calls count with correct filters', async () => {
      usersRepository.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(60)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(80);

      await provider.getStats();

      // total count
      expect(usersRepository.count).toHaveBeenNthCalledWith(1, {
        where: { isDeleted: false },
      });
      // active
      expect(usersRepository.count).toHaveBeenNthCalledWith(2, {
        where: {
          membershipStatus: 'active',
          isDeleted: false,
        },
      });
      // suspended
      expect(usersRepository.count).toHaveBeenNthCalledWith(4, {
        where: {
          membershipStatus: 'suspended',
          isDeleted: false,
        },
      });
    });
  });
});
