import { Test, TestingModule } from '@nestjs/testing';
import { MemberDashboardProvider } from './member-dashboard.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { WorkspaceLog } from '../../workspace-tracking/entities/workspace-log.entity';
import { BookingStatus } from '../../bookings/enums/booking-status.enum';
import { PaymentStatus } from '../../payments/enums/payment-status.enum';

describe('MemberDashboardProvider', () => {
  let provider: MemberDashboardProvider;
  let bookingsRepository: any;
  let paymentsRepository: any;
  let invoicesRepository: any;
  let workspaceLogsRepository: any;

  beforeEach(async () => {
    bookingsRepository = {
      count: jest.fn(),
      findAndCount: jest.fn(),
    };
    paymentsRepository = {
      createQueryBuilder: jest.fn(),
      findAndCount: jest.fn(),
    };
    invoicesRepository = {
      count: jest.fn(),
      findAndCount: jest.fn(),
    };
    workspaceLogsRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemberDashboardProvider,
        { provide: getRepositoryToken(Booking), useValue: bookingsRepository },
        { provide: getRepositoryToken(Payment), useValue: paymentsRepository },
        { provide: getRepositoryToken(Invoice), useValue: invoicesRepository },
        {
          provide: getRepositoryToken(WorkspaceLog),
          useValue: workspaceLogsRepository,
        },
      ],
    }).compile();

    provider = module.get<MemberDashboardProvider>(MemberDashboardProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getMemberStats', () => {
    function mockPaymentsQueryBuilder(total: string) {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total }),
      };
      paymentsRepository.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    it('returns aggregated member stats', async () => {
      bookingsRepository.count.mockResolvedValue(3);
      mockPaymentsQueryBuilder('50000');
      invoicesRepository.count.mockResolvedValue(5);
      workspaceLogsRepository.findOne.mockResolvedValue({
        checkedInAt: new Date('2024-01-15'),
      });

      const result = await provider.getMemberStats('user-1');

      expect(result).toEqual({
        activeBookings: 3,
        totalSpentKobo: 50000,
        totalSpentNaira: 500,
        invoiceCount: 5,
        lastCheckIn: expect.any(Date),
      });
      expect(bookingsRepository.count).toHaveBeenCalledWith({
        where: [
          { userId: 'user-1', status: BookingStatus.CONFIRMED },
          { userId: 'user-1', status: BookingStatus.PENDING },
        ],
      });
    });

    it('returns zero values when no data exists', async () => {
      bookingsRepository.count.mockResolvedValue(0);
      mockPaymentsQueryBuilder('0');
      invoicesRepository.count.mockResolvedValue(0);
      workspaceLogsRepository.findOne.mockResolvedValue(null);

      const result = await provider.getMemberStats('user-1');

      expect(result).toEqual({
        activeBookings: 0,
        totalSpentKobo: 0,
        totalSpentNaira: 0,
        invoiceCount: 0,
        lastCheckIn: null,
      });
    });
  });

  describe('getMemberBookings', () => {
    it('returns paginated bookings', async () => {
      const bookings = [
        { id: 'booking-1', status: 'confirmed' },
        { id: 'booking-2', status: 'pending' },
      ];
      bookingsRepository.findAndCount.mockResolvedValue([bookings, 2]);

      const result = await provider.getMemberBookings('user-1', 1, 20);

      expect(result.data).toEqual(bookings);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('getMemberPayments', () => {
    it('returns paginated payments', async () => {
      const payments = [{ id: 'pay-1', amount: 50000 }];
      paymentsRepository.findAndCount.mockResolvedValue([payments, 1]);

      const result = await provider.getMemberPayments('user-1', 1, 10);

      expect(result.data).toEqual(payments);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getMemberInvoices', () => {
    it('returns paginated invoices', async () => {
      const invoices = [{ id: 'inv-1', invoiceNumber: 'INV-001' }];
      invoicesRepository.findAndCount.mockResolvedValue([invoices, 1]);

      const result = await provider.getMemberInvoices('user-1', 1, 10);

      expect(result.data).toEqual(invoices);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getMemberCheckIns', () => {
    it('returns recent check-ins', async () => {
      const logs = [{ id: 'log-1', checkedInAt: new Date() }];
      workspaceLogsRepository.find.mockResolvedValue(logs);

      const result = await provider.getMemberCheckIns('user-1', 10);

      expect(result).toEqual(logs);
      expect(workspaceLogsRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { checkedInAt: 'DESC' },
        take: 10,
      });
    });
  });

  describe('getMemberDashboard', () => {
    it('returns combined dashboard data', async () => {
      bookingsRepository.count.mockResolvedValue(2);
      const payQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '30000' }),
      };
      paymentsRepository.createQueryBuilder.mockReturnValue(payQb);
      invoicesRepository.count.mockResolvedValue(3);
      workspaceLogsRepository.findOne.mockResolvedValue(null);
      bookingsRepository.findAndCount.mockResolvedValue([
        [{ id: 'booking-1' }],
        1,
      ]);
      paymentsRepository.findAndCount.mockResolvedValue([
        [{ id: 'pay-1' }],
        1,
      ]);

      const result = await provider.getMemberDashboard('user-1');

      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('recentBookings');
      expect(result).toHaveProperty('recentPayments');
      expect(result.recentBookings).toHaveLength(1);
      expect(result.recentPayments).toHaveLength(1);
    });
  });
});
