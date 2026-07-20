import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { NewsletterSubscriber } from '../newsletter/entities/newsletter.entity';
import { AdminAnalyticsProvider } from './providers/admin-analytics.provider';
import { MemberDashboardProvider } from './providers/member-dashboard.provider';

describe('DashboardService', () => {
  let service: DashboardService;
  let userRepository: any;
  let newsletterRepository: any;
  let adminAnalyticsProvider: any;
  let memberDashboardProvider: any;

  beforeEach(async () => {
    userRepository = {
      count: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    newsletterRepository = {
      count: jest.fn(),
    };
    adminAnalyticsProvider = {
      getActiveWorkspacesCount: jest.fn(),
      getFullAdminDashboard: jest.fn(),
    };
    memberDashboardProvider = {
      getMemberDashboard: jest.fn(),
      getMemberBookings: jest.fn(),
      getMemberPayments: jest.fn(),
      getMemberInvoices: jest.fn(),
      getMemberCheckIns: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: getRepositoryToken(NewsletterSubscriber),
          useValue: newsletterRepository,
        },
        {
          provide: AdminAnalyticsProvider,
          useValue: adminAnalyticsProvider,
        },
        {
          provide: MemberDashboardProvider,
          useValue: memberDashboardProvider,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserStats', () => {
    it('returns user-visible stats', async () => {
      userRepository.count
        .mockResolvedValueOnce(100) // totalMembers (isActive)
        .mockResolvedValueOnce(60); // verifiedMembers
      adminAnalyticsProvider.getActiveWorkspacesCount.mockResolvedValue(10);

      const result = await service.getUserStats('user-1');

      expect(result).toEqual({
        totalMembers: 100,
        verifiedMembers: 60,
        activeWorkspaces: 10,
        deskOccupancy: 60,
      });
    });
  });

  describe('getActivity', () => {
    it('returns recent user registration/verification activity', async () => {
      const users = [
        {
          id: '1',
          firstname: 'Alice',
          lastname: 'Smith',
          email: 'alice@example.com',
          createdAt: new Date('2024-01-15'),
          isVerified: true,
        },
        {
          id: '2',
          firstname: 'Bob',
          lastname: 'Jones',
          email: 'bob@example.com',
          createdAt: new Date('2024-01-14'),
          isVerified: false,
        },
      ];
      userRepository.find.mockResolvedValue(users);

      const result = await service.getActivity();

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('member_verified');
      expect(result[1].type).toBe('member_registered');
    });
  });

  describe('getAdminStats', () => {
    function mockCounts() {
      let callCount = 0;
      userRepository.count.mockImplementation(() => {
        callCount++;
        const counts = [200, 150, 5, 20, 100, 80, 70, 30];
        return Promise.resolve(counts[callCount - 1]);
      });
      newsletterRepository.count.mockImplementation(() => {
        callCount++;
        const counts = [100, 80, 70, 30];
        return Promise.resolve(counts[callCount - 5]);
      });
    }

    it('returns admin stats with registration trend', async () => {
      mockCounts();
      userRepository.createQueryBuilder.mockReturnValue({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
      });

      const result = await service.getAdminStats();

      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('newsletter');
      expect(result).toHaveProperty('registrationTrend');
      expect(result.users.total).toBe(200);
      expect(result.users.active).toBe(150);
      expect(result.newsletter.total).toBe(100);
      expect(result.newsletter.confirmationRate).toBe(80);
    });
  });

  describe('getUsers', () => {
    it('returns paginated users list', async () => {
      const users = [{ id: 'user-1', email: 'alice@example.com' }];
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([users, 1]),
      };
      userRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getUsers(1, 10);

      expect(result.data).toEqual(users);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('filters by search term', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      userRepository.createQueryBuilder.mockReturnValue(qb);

      await service.getUsers(1, 10, 'alice');

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(user.firstname ILIKE :search OR user.lastname ILIKE :search OR user.email ILIKE :search)',
        { search: '%alice%' },
      );
    });
  });

  describe('delegation methods', () => {
    it('getAdminAnalytics delegates to AdminAnalyticsProvider', async () => {
      const data = { revenue: {} };
      adminAnalyticsProvider.getFullAdminDashboard.mockResolvedValue(data);

      const result = await service.getAdminAnalytics('from', 'to');

      expect(result).toEqual(data);
      expect(adminAnalyticsProvider.getFullAdminDashboard).toHaveBeenCalledWith(
        'from',
        'to',
      );
    });

    it('getMemberDashboard delegates to MemberDashboardProvider', async () => {
      memberDashboardProvider.getMemberDashboard.mockResolvedValue({
        stats: {},
      });

      const result = await service.getMemberDashboard('user-1');

      expect(result).toEqual({ stats: {} });
    });

    it('getMemberBookings delegates to MemberDashboardProvider', async () => {
      memberDashboardProvider.getMemberBookings.mockResolvedValue({
        data: [],
        meta: {},
      });

      const result = await service.getMemberBookings('user-1', 1, 20);

      expect(result.data).toEqual([]);
    });

    it('getMemberPayments delegates to MemberDashboardProvider', async () => {
      memberDashboardProvider.getMemberPayments.mockResolvedValue({
        data: [],
        meta: {},
      });

      const result = await service.getMemberPayments('user-1', 1, 20);

      expect(result.data).toEqual([]);
    });

    it('getMemberInvoices delegates to MemberDashboardProvider', async () => {
      memberDashboardProvider.getMemberInvoices.mockResolvedValue({
        data: [],
        meta: {},
      });

      const result = await service.getMemberInvoices('user-1', 1, 20);

      expect(result.data).toEqual([]);
    });

    it('getMemberCheckIns delegates to MemberDashboardProvider', async () => {
      memberDashboardProvider.getMemberCheckIns.mockResolvedValue([]);

      const result = await service.getMemberCheckIns('user-1', 10);

      expect(result).toEqual([]);
    });
  });
});
