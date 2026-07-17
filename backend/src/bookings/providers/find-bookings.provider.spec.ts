import { NotFoundException } from '@nestjs/common';
import { FindBookingsProvider } from './find-bookings.provider';
import { UserRole } from '../../users/enums/userRoles.enum';
import { BookingStatus } from '../enums/booking-status.enum';

describe('FindBookingsProvider', () => {
  let provider: FindBookingsProvider;
  let bookingsRepository: any;

  beforeEach(() => {
    bookingsRepository = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
    };
    provider = new FindBookingsProvider(bookingsRepository);
  });

  function mockQueryBuilder(overrides: any = {}) {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(overrides.total ?? 0),
      getMany: jest.fn().mockResolvedValue(overrides.data ?? []),
    };
    bookingsRepository.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  describe('findAll', () => {
    it('filters by userId for regular users', async () => {
      const qb = mockQueryBuilder({ total: 1, data: [{ id: 'booking-1' }] });

      const result = await provider.findAll(
        {},
        'user-1',
        UserRole.USER,
      );

      expect(qb.where).toHaveBeenCalledWith('booking.userId = :userId', {
        userId: 'user-1',
      });
      expect(result.data).toHaveLength(1);
    });

    it('does not filter by userId for admins', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll({}, 'admin-1', UserRole.ADMIN);

      expect(qb.where).not.toHaveBeenCalled();
    });

    it('filters by userId query param for admins', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll(
        { userId: 'specific-user' },
        'admin-1',
        UserRole.ADMIN,
      );

      expect(qb.where).toHaveBeenCalledWith('booking.userId = :userId', {
        userId: 'specific-user',
      });
    });

    it('applies status filter', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll(
        { status: BookingStatus.PENDING },
        'admin-1',
        UserRole.ADMIN,
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        'booking.status = :status',
        { status: BookingStatus.PENDING },
      );
    });

    it('applies workspaceId filter', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll(
        { workspaceId: 'ws-1' },
        'admin-1',
        UserRole.ADMIN,
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        'booking.workspaceId = :workspaceId',
        { workspaceId: 'ws-1' },
      );
    });

    it('applies date range filters', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll(
        { startDate: '2024-01-01', endDate: '2024-01-31' },
        'admin-1',
        UserRole.ADMIN,
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        'booking.startDate >= :startDate',
        { startDate: '2024-01-01' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'booking.endDate <= :endDate',
        { endDate: '2024-01-31' },
      );
    });

    it('applies pagination', async () => {
      const qb = mockQueryBuilder({ total: 30, data: [] });

      const result = await provider.findAll(
        { page: 2, limit: 10 },
        'admin-1',
        UserRole.ADMIN,
      );

      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('findById', () => {
    it('returns booking when found and owned by user', async () => {
      const booking = { id: 'booking-1', userId: 'user-1' };
      bookingsRepository.findOne.mockResolvedValue(booking);

      const result = await provider.findById('booking-1', 'user-1', UserRole.USER);
      expect(result).toEqual(booking);
    });

    it('returns booking for admin regardless of ownership', async () => {
      const booking = { id: 'booking-1', userId: 'user-2' };
      bookingsRepository.findOne.mockResolvedValue(booking);

      const result = await provider.findById('booking-1', 'admin-1', UserRole.ADMIN);
      expect(result).toEqual(booking);
    });

    it('throws NotFoundException when booking does not exist', async () => {
      bookingsRepository.findOne.mockResolvedValue(null);

      await expect(
        provider.findById('unknown', 'user-1', UserRole.USER),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when non-admin tries to view another users booking', async () => {
      bookingsRepository.findOne.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-2',
      });

      await expect(
        provider.findById('booking-1', 'user-1', UserRole.USER),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
