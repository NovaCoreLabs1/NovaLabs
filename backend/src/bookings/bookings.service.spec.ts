import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { CreateBookingProvider } from './providers/create-booking.provider';
import { CreatePublicDayPassProvider } from './providers/create-public-day-pass.provider';
import { ConfirmBookingProvider } from './providers/confirm-booking.provider';
import { CancelBookingProvider } from './providers/cancel-booking.provider';
import { CompleteBookingProvider } from './providers/complete-booking.provider';
import { FindBookingsProvider } from './providers/find-bookings.provider';
import { PricingService } from './pricing/pricing.service';
import { PlanType } from './enums/plan-type.enum';
import { UserRole } from '../users/enums/userRoles.enum';

describe('BookingsService', () => {
  let service: BookingsService;
  let createProvider: jest.Mocked<Partial<CreateBookingProvider>>;
  let publicDayPassProvider: jest.Mocked<Partial<CreatePublicDayPassProvider>>;
  let confirmProvider: jest.Mocked<Partial<ConfirmBookingProvider>>;
  let cancelProvider: jest.Mocked<Partial<CancelBookingProvider>>;
  let completeProvider: jest.Mocked<Partial<CompleteBookingProvider>>;
  let findProvider: jest.Mocked<Partial<FindBookingsProvider>>;
  let pricingService: jest.Mocked<Partial<PricingService>>;

  beforeEach(async () => {
    createProvider = { create: jest.fn() };
    publicDayPassProvider = { create: jest.fn() };
    confirmProvider = { confirm: jest.fn() };
    cancelProvider = { cancel: jest.fn() };
    completeProvider = { complete: jest.fn() };
    findProvider = { findAll: jest.fn(), findById: jest.fn() };
    pricingService = { calculateAmount: jest.fn(), getPlanSummary: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: CreateBookingProvider, useValue: createProvider },
        { provide: CreatePublicDayPassProvider, useValue: publicDayPassProvider },
        { provide: ConfirmBookingProvider, useValue: confirmProvider },
        { provide: CancelBookingProvider, useValue: cancelProvider },
        { provide: CompleteBookingProvider, useValue: completeProvider },
        { provide: FindBookingsProvider, useValue: findProvider },
        { provide: PricingService, useValue: pricingService },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  describe('create', () => {
    it('delegates to CreateBookingProvider', async () => {
      const dto = { workspaceId: 'ws-1' } as any;
      createProvider.create.mockResolvedValue({ id: 'booking-1' } as any);

      const result = await service.create(dto, 'user-1');
      expect(result).toEqual({ id: 'booking-1' });
      expect(createProvider.create).toHaveBeenCalledWith(dto, 'user-1');
    });
  });

  describe('publicDayPass', () => {
    it('delegates to CreatePublicDayPassProvider', async () => {
      const dto = { guestName: 'John' } as any;
      publicDayPassProvider.create.mockResolvedValue({
        bookingId: 'booking-1',
        authorizationUrl: 'https://paystack.com',
      } as any);

      const result = await service.publicDayPass(dto);
      expect(result).toEqual({
        bookingId: 'booking-1',
        authorizationUrl: 'https://paystack.com',
      });
      expect(publicDayPassProvider.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('confirm', () => {
    it('delegates to ConfirmBookingProvider', async () => {
      confirmProvider.confirm.mockResolvedValue({ id: 'booking-1' } as any);

      const result = await service.confirm('booking-1');
      expect(result).toEqual({ id: 'booking-1' });
      expect(confirmProvider.confirm).toHaveBeenCalledWith('booking-1');
    });
  });

  describe('cancel', () => {
    it('delegates to CancelBookingProvider', async () => {
      cancelProvider.cancel.mockResolvedValue({ id: 'booking-1' } as any);

      const result = await service.cancel('booking-1', 'user-1', UserRole.USER);
      expect(result).toEqual({ id: 'booking-1' });
      expect(cancelProvider.cancel).toHaveBeenCalledWith(
        'booking-1',
        'user-1',
        UserRole.USER,
      );
    });
  });

  describe('complete', () => {
    it('delegates to CompleteBookingProvider', async () => {
      completeProvider.complete.mockResolvedValue({ id: 'booking-1' } as any);

      const result = await service.complete('booking-1');
      expect(result).toEqual({ id: 'booking-1' });
      expect(completeProvider.complete).toHaveBeenCalledWith('booking-1');
    });
  });

  describe('findAll', () => {
    it('delegates to FindBookingsProvider', async () => {
      const query = { page: 1 } as any;
      findProvider.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const result = await service.findAll(query, 'user-1', UserRole.USER);
      expect(result.total).toBe(0);
      expect(findProvider.findAll).toHaveBeenCalledWith(query, 'user-1', UserRole.USER);
    });
  });

  describe('findById', () => {
    it('delegates to FindBookingsProvider', async () => {
      findProvider.findById.mockResolvedValue({ id: 'booking-1' } as any);

      const result = await service.findById('booking-1', 'user-1', UserRole.USER);
      expect(result).toEqual({ id: 'booking-1' });
      expect(findProvider.findById).toHaveBeenCalledWith(
        'booking-1',
        'user-1',
        UserRole.USER,
      );
    });
  });

  describe('calculatePrice', () => {
    it('delegates to PricingService', () => {
      pricingService.calculateAmount.mockReturnValue(500000);

      const result = service.calculatePrice(
        50000,
        PlanType.DAILY,
        1,
        '2024-01-01',
        '2024-01-01',
      );
      expect(result).toBe(500000);
      expect(pricingService.calculateAmount).toHaveBeenCalledWith(
        50000,
        PlanType.DAILY,
        1,
        '2024-01-01',
        '2024-01-01',
      );
    });
  });

  describe('getPlanSummary', () => {
    it('delegates to PricingService', () => {
      pricingService.getPlanSummary.mockReturnValue({ days: 22, discountPct: 10 });

      const result = service.getPlanSummary(PlanType.MONTHLY);
      expect(result).toEqual({ days: 22, discountPct: 10 });
      expect(pricingService.getPlanSummary).toHaveBeenCalledWith(PlanType.MONTHLY);
    });
  });
});
