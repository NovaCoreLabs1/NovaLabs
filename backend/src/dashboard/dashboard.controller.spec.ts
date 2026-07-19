import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: any;

  const mockUser = { id: 'user-1', role: 'user' };

  beforeEach(async () => {
    dashboardService = {
      getUserStats: jest.fn(),
      getActivity: jest.fn(),
      getAdminStats: jest.fn(),
      getUsers: jest.fn(),
      getAdminAnalytics: jest.fn(),
      getMemberDashboard: jest.fn(),
      getMemberBookings: jest.fn(),
      getMemberPayments: jest.fn(),
      getMemberInvoices: jest.fn(),
      getMemberCheckIns: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: dashboardService }],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStats', () => {
    it('returns user stats', async () => {
      const stats = { totalMembers: 100, verifiedMembers: 60 };
      dashboardService.getUserStats.mockResolvedValue(stats);

      const result = await controller.getStats(mockUser as any);

      expect(result).toEqual({ success: true, data: stats });
      expect(dashboardService.getUserStats).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getActivity', () => {
    it('returns recent activity', async () => {
      const activity = [{ id: 'u-1', type: 'member_registered' }];
      dashboardService.getActivity.mockResolvedValue(activity);

      const result = await controller.getActivity();

      expect(result).toEqual({ success: true, data: activity });
    });
  });

  describe('getAdminStats', () => {
    it('returns admin stats', async () => {
      const stats = { users: { total: 100 } };
      dashboardService.getAdminStats.mockResolvedValue(stats);

      const result = await controller.getAdminStats();

      expect(result).toEqual({ success: true, data: stats });
    });
  });

  describe('getAdminUsers', () => {
    it('returns paginated users with defaults', async () => {
      const data = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      dashboardService.getUsers.mockResolvedValue(data);

      const result = await controller.getAdminUsers('1', '10');

      expect(result).toEqual({ success: true, ...data });
      expect(dashboardService.getUsers).toHaveBeenCalledWith(1, 10, undefined);
    });

    it('parses and clamps pagination parameters', async () => {
      dashboardService.getUsers.mockResolvedValue({ data: [], meta: {} });

      await controller.getAdminUsers('0', '100');

      // page clamped to min 1, limit clamped to max 50
      expect(dashboardService.getUsers).toHaveBeenCalledWith(1, 50, undefined);
    });

    it('passes search term to service', async () => {
      dashboardService.getUsers.mockResolvedValue({ data: [], meta: {} });

      await controller.getAdminUsers('1', '10', 'alice');

      expect(dashboardService.getUsers).toHaveBeenCalledWith(1, 10, 'alice');
    });
  });

  describe('getAdminAnalytics', () => {
    it('returns admin analytics', async () => {
      dashboardService.getAdminAnalytics.mockResolvedValue({ revenue: {} });

      const result = await controller.getAdminAnalytics(
        '2024-01-01',
        '2024-01-31',
      );

      expect(result).toEqual({ success: true, data: { revenue: {} } });
      expect(dashboardService.getAdminAnalytics).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-31',
      );
    });
  });

  describe('getMemberDashboard', () => {
    it('returns member dashboard', async () => {
      const data = { stats: {} };
      dashboardService.getMemberDashboard.mockResolvedValue(data);

      const result = await controller.getMemberDashboard('user-1');

      expect(result).toEqual({ success: true, data });
    });
  });

  describe('getMemberBookings', () => {
    it('returns paginated member bookings', async () => {
      dashboardService.getMemberBookings.mockResolvedValue({
        data: [],
        meta: { total: 0 },
      });

      const result = await controller.getMemberBookings('user-1', '1', '10');

      expect(result).toEqual({ success: true, data: [], meta: { total: 0 } });
    });
  });

  describe('getMemberPayments', () => {
    it('returns paginated member payments', async () => {
      dashboardService.getMemberPayments.mockResolvedValue({
        data: [],
        meta: { total: 0 },
      });

      const result = await controller.getMemberPayments('user-1', '1', '10');

      expect(result).toEqual({
        success: true,
        ...{ data: [], meta: { total: 0 } },
      });
    });
  });

  describe('getMemberInvoices', () => {
    it('returns paginated member invoices', async () => {
      dashboardService.getMemberInvoices.mockResolvedValue({
        data: [],
        meta: { total: 0 },
      });

      const result = await controller.getMemberInvoices('user-1', '1', '10');

      expect(result).toEqual({
        success: true,
        ...{ data: [], meta: { total: 0 } },
      });
    });
  });

  describe('getMemberCheckIns', () => {
    it('returns member check-ins', async () => {
      dashboardService.getMemberCheckIns.mockResolvedValue([]);

      const result = await controller.getMemberCheckIns('user-1', '10');

      expect(result).toEqual({ success: true, data: [] });
      expect(dashboardService.getMemberCheckIns).toHaveBeenCalledWith(
        'user-1',
        10,
      );
    });
  });
});
