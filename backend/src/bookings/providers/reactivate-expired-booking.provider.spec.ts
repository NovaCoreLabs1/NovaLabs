import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Booking } from '../entities/booking.entity';
import { BookingStatus } from '../enums/booking-status.enum';
import { PlanType } from '../enums/plan-type.enum';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { User } from '../../users/entities/user.entity';
import { ReactivateExpiredBookingProvider } from './reactivate-expired-booking.provider';

function expiredBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: overrides.id ?? '00000000-0000-4000-8000-00000000000a',
    workspaceId: overrides.workspaceId ?? 'ws-1',
    userId: null,
    planType: PlanType.DAILY,
    startDate: '2026-01-01',
    endDate: '2026-01-01',
    totalAmount: 10_000,
    status: BookingStatus.EXPIRED,
    seatCount: 1,
    notes: null,
    sorobanEscrowId: null,
    reminderSent: false,
    isGuestBooking: true,
    guestInfo: { name: 'G', email: 'g@e.com', phone: '0' },
    paymentDeadline: new Date(Date.now() - 60_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    hubId: null,
  } as unknown as Booking;
}

function workspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    name: 'Hub West',
    isActive: true,
    totalSeats: overrides.totalSeats ?? 3,
    hourlyRate: 10000n,
  } as unknown as Workspace;
}

/**
 * Builds a fake EntityManager covering the three query paths the provider
 * uses: booking lookup by id, locked workspace lookup, and the overlap SUM.
 */
function fakeManager(options: {
  booking?: Booking | null;
  workspace?: Workspace | null;
  bookedSeats?: number;
  saveImpl?: (entity: unknown) => Promise<unknown>;
}): EntityManager {
  const manager = {
    findOne: jest.fn(
      (_target: unknown, criteria?: { where?: { id?: string } }) => {
        if (_target === Booking)
          return Promise.resolve(options.booking ?? null);
        return Promise.resolve(null);
      },
    ),
    getRepository: jest.fn(() => ({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    })),
    createQueryBuilder: jest.fn((target: unknown) => {
      if (target === Workspace) {
        return {
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: () => Promise.resolve(options.workspace ?? null),
        };
      }
      // Booking overlap-sum builder
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: () =>
          Promise.resolve({ booked: String(options.bookedSeats ?? 0) }),
      };
    }),
    save: jest.fn(
      options.saveImpl ?? ((entity: unknown) => Promise.resolve(entity)),
    ),
  };
  return manager as unknown as EntityManager;
}

describe('ReactivateExpiredBookingProvider', () => {
  let provider: ReactivateExpiredBookingProvider;
  let currentManager: EntityManager | null = null;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReactivateExpiredBookingProvider],
    })
      .useMocker((token) => {
        if (token === DataSource) {
          return {
            transaction: jest.fn((fn: (m: EntityManager) => Promise<unknown>) =>
              fn(currentManager!),
            ),
          };
        }
        return jest.fn();
      })
      .compile();

    provider = module.get<ReactivateExpiredBookingProvider>(
      ReactivateExpiredBookingProvider,
    );
  });

  describe('when seats are still free', () => {
    it('re-confirms the expired booking and returns it', async () => {
      const booking = expiredBooking();
      let saved: Booking | null = null;
      currentManager = fakeManager({
        booking,
        workspace: workspace({ totalSeats: 3 }),
        bookedSeats: 2, // 2 + 1 requested = exactly full → fits
        saveImpl: async (entity) => {
          saved = entity as Booking;
          return entity;
        },
      });

      const result = await provider.reactivateExpired(booking.id);

      expect(result).not.toBeNull();
      expect(saved?.status).toBe(BookingStatus.CONFIRMED);
    });
  });

  describe('when the seats have been taken meanwhile', () => {
    it('returns null without changing the booking', async () => {
      const booking = expiredBooking();
      currentManager = fakeManager({
        booking,
        workspace: workspace({ totalSeats: 3 }),
        bookedSeats: 3, // already full
      });

      const result = await provider.reactivateExpired(booking.id);

      expect(result).toBeNull();
      expect(booking.status).toBe(BookingStatus.EXPIRED);
    });
  });

  describe('unexpected states', () => {
    it('throws NotFound for an unknown booking', async () => {
      currentManager = fakeManager({ booking: null });

      await expect(provider.reactivateExpired('nope')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns an already-CONFIRMED booking untouched (concurrent webhook)', async () => {
      const confirmed = expiredBooking();
      confirmed.status = BookingStatus.CONFIRMED;
      currentManager = fakeManager({ booking: confirmed });

      const result = await provider.reactivateExpired(confirmed.id);

      expect(result).toBe(confirmed);
    });

    it('throws for bookings in any other state', async () => {
      const cancelled = expiredBooking();
      cancelled.status = BookingStatus.CANCELLED;
      currentManager = fakeManager({ booking: cancelled });

      await expect(provider.reactivateExpired(cancelled.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when the workspace no longer exists', async () => {
      const booking = expiredBooking();
      currentManager = fakeManager({ booking, workspace: null });

      await expect(provider.reactivateExpired(booking.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
