import { Test, TestingModule } from '@nestjs/testing';
import { AdminAnalyticsProvider } from './admin-analytics.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { WorkspaceLog } from '../../workspace-tracking/entities/workspace-log.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { DataSource } from 'typeorm';
import { PaymentStatus } from '../../payments/enums/payment-status.enum';

describe('AdminAnalyticsProvider', () => {
  let provider: AdminAnalyticsProvider;
  let bookingsRepository: any;
  let paymentsRepository: any;
  let invoicesRepository: any;
  let workspaceLogsRepository: any;
  let workspacesRepository: any;
  let dataSource: any;

  beforeEach(async () => {
    bookingsRepository = {
      createQueryBuilder: jest.fn(),
    };
    paymentsRepository = {
      createQueryBuilder: jest.fn(),
    };
    invoicesRepository = {
      createQueryBuilder: jest.fn(),
    };
    workspaceLogsRepository = {
      createQueryBuilder: jest.fn(),
      getCount: jest.fn(),
    };
    workspacesRepository = {
      createQueryBuilder: jest.fn(),
      count: jest.fn(),
    };
    dataSource = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAnalyticsProvider,
        { provide: getRepositoryToken(Booking), useValue: bookingsRepository },
        { provide: getRepositoryToken(Payment), useValue: paymentsRepository },
        { provide: getRepositoryToken(Invoice), useValue: invoicesRepository },
        {
          provide: getRepositoryToken(WorkspaceLog),
          useValue: workspaceLogsRepository,
        },
        {
          provide: getRepositoryToken(Workspace),
          useValue: workspacesRepository,
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    provider = module.get<AdminAnalyticsProvider>(AdminAnalyticsProvider);
  });

  // Helper to create a simple query builder
  function mockQb(overrides: any = {}) {
    return {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(overrides.rawMany ?? []),
      getRawOne: jest
        .fn()
        .mockResolvedValue(overrides.rawOne ?? { total: '0' }),
      getCount: jest.fn().mockResolvedValue(overrides.count ?? 0),
      clone: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
    };
  }

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getRevenueStats', () => {
    it('returns revenue statistics with trend', async () => {
      paymentsRepository.createQueryBuilder
        .mockReturnValueOnce(mockQb({ rawOne: { total: '500000' } })) // total
        .mockReturnValueOnce(mockQb({ rawOne: { total: '200000' } })) // this month
        .mockReturnValueOnce(mockQb({ rawOne: { total: '150000' } })); // last month

      dataSource.query.mockResolvedValue([
        { month: '2024-01-01', total: '80000' },
        { month: '2024-02-01', total: '90000' },
      ]);

      const result = await provider.getRevenueStats();

      expect(result.total).toBe(500000);
      expect(result.thisMonth).toBe(200000);
      expect(result.lastMonth).toBe(150000);
      expect(result.trend).toHaveLength(2);
    });

    it('applies date range filters', async () => {
      const qbTotal = mockQb({ rawOne: { total: '100000' } });
      const qbThisMonth = mockQb({ rawOne: { total: '100000' } });
      const qbLastMonth = mockQb({ rawOne: { total: '100000' } });
      paymentsRepository.createQueryBuilder
        .mockReturnValueOnce(qbTotal)
        .mockReturnValueOnce(qbThisMonth)
        .mockReturnValueOnce(qbLastMonth);
      dataSource.query.mockResolvedValue([]);

      await provider.getRevenueStats('2024-01-01', '2024-01-31');

      expect(qbTotal.where).toHaveBeenCalledWith('p.status = :status', {
        status: PaymentStatus.SUCCESS,
      });
      expect(qbTotal.andWhere).toHaveBeenCalledWith('p.paidAt >= :from', {
        from: '2024-01-01',
      });
      expect(qbTotal.andWhere).toHaveBeenCalledWith('p.paidAt <= :to', {
        to: '2024-01-31',
      });
    });
  });

  describe('getActiveWorkspacesCount', () => {
    it('returns count of active workspaces', async () => {
      workspacesRepository.count.mockResolvedValue(5);

      const result = await provider.getActiveWorkspacesCount();

      expect(result).toBe(5);
      expect(workspacesRepository.count).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });
  });

  describe('getOccupancySnapshot', () => {
    it('returns occupancy data', async () => {
      workspacesRepository.createQueryBuilder.mockReturnValue(
        mockQb({ rawOne: { total: '50' } }),
      );
      workspaceLogsRepository.createQueryBuilder.mockReturnValue(
        mockQb({ count: 10 }),
      );
      workspacesRepository.count.mockResolvedValue(5);

      const result = await provider.getOccupancySnapshot();

      expect(result).toEqual({
        totalSeats: 50,
        occupiedSeats: 10,
        availableSeats: 40,
        occupancyPercent: 20,
        activeWorkspaces: 5,
      });
    });
  });

  describe('getBookingStats', () => {
    it('returns booking stats by status and trend', async () => {
      const qb = mockQb({
        rawMany: [
          { status: 'confirmed', count: '10' },
          { status: 'pending', count: '5' },
        ],
      });
      bookingsRepository.createQueryBuilder.mockReturnValue(qb);
      dataSource.query.mockResolvedValue([
        { month: '2024-01-01', count: '15' },
      ]);

      const result = await provider.getBookingStats();

      expect(result.byStatus).toEqual({ confirmed: 10, pending: 5 });
      expect(result.trend).toHaveLength(1);
    });
  });

  describe('getTopWorkspaces', () => {
    it('returns top workspaces via raw query', async () => {
      dataSource.query.mockResolvedValue([
        { id: 'ws-1', name: 'Desk A', bookings: '10', revenueKobo: '500000' },
      ]);

      const result = await provider.getTopWorkspaces(5);

      expect(result).toHaveLength(1);
      expect(dataSource.query).toHaveBeenCalled();
    });
  });

  describe('getTopMembers', () => {
    it('returns top members via raw query', async () => {
      dataSource.query.mockResolvedValue([
        { id: 'user-1', fullName: 'Alice Smith', totalKobo: '300000' },
      ]);

      const result = await provider.getTopMembers(5);

      expect(result).toHaveLength(1);
    });
  });

  describe('getInvoiceStats', () => {
    it('returns invoice statistics', async () => {
      const baseQb = mockQb({ count: 20, rawOne: { total: '500000' } });

      // Prepare distinct QBs for clone() calls so that getCount returns
      // different values for total vs paid vs pending.
      const totalQb = mockQb({ count: 20, rawOne: { total: '500000' } });
      const amountQb = mockQb({ count: 20, rawOne: { total: '500000' } });
      const paidQb = mockQb({ count: 0, rawOne: { total: '500000' } });
      const pendingQb = mockQb({ count: 0, rawOne: { total: '500000' } });

      let cloneIdx = 0;
      baseQb.clone = jest.fn().mockImplementation(() => {
        const clones = [totalQb, amountQb, paidQb, pendingQb];
        return clones[cloneIdx++];
      });

      invoicesRepository.createQueryBuilder.mockReturnValue(baseQb);

      const result = await provider.getInvoiceStats();

      expect(result.total).toBe(20);
      expect(result.totalAmountKobo).toBe(500000);
      expect(result.totalAmountNaira).toBe(5000);
      expect(result.paid).toBe(0);
      expect(result.pending).toBe(0);
    });
  });

  describe('getFullAdminDashboard', () => {
    it('returns combined dashboard object', async () => {
      paymentsRepository.createQueryBuilder
        .mockReturnValueOnce(mockQb({ rawOne: { total: '100000' } }))
        .mockReturnValueOnce(mockQb({ rawOne: { total: '40000' } }))
        .mockReturnValueOnce(mockQb({ rawOne: { total: '30000' } }));
      dataSource.query.mockResolvedValue([]);
      bookingsRepository.createQueryBuilder.mockReturnValue(
        mockQb({ rawMany: [] }),
      );
      dataSource.query
        .mockResolvedValueOnce([]) // trend (bookings)
        .mockResolvedValueOnce([]) // topWorkspaces
        .mockResolvedValueOnce([]); // topMembers
      invoicesRepository.createQueryBuilder.mockReturnValue(
        mockQb({ count: 0, rawOne: { total: '0' } }),
      );
      workspacesRepository.createQueryBuilder.mockReturnValue(
        mockQb({ rawOne: { total: '0' } }),
      );
      workspaceLogsRepository.createQueryBuilder.mockReturnValue(
        mockQb({ count: 0 }),
      );
      workspacesRepository.count.mockResolvedValue(0);

      const result = await provider.getFullAdminDashboard();

      expect(result).toHaveProperty('revenue');
      expect(result).toHaveProperty('bookings');
      expect(result).toHaveProperty('topWorkspaces');
      expect(result).toHaveProperty('topMembers');
      expect(result).toHaveProperty('invoices');
      expect(result).toHaveProperty('occupancy');
    });
  });
});
