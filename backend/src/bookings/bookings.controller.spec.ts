import { Test, TestingModule } from '@nestjs/testing';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PlanType } from './enums/plan-type.enum';
import { UserRole } from '../users/enums/userRoles.enum';

describe('BookingsController', () => {
  let controller: BookingsController;
  let service: jest.Mocked<Partial<BookingsService>>;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      publicDayPass: jest.fn(),
      confirm: jest.fn(),
      cancel: jest.fn(),
      complete: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      calculatePrice: jest.fn(),
      getPlanSummary: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [{ provide: BookingsService, useValue: service }],
    }).compile();

    controller = module.get<BookingsController>(BookingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('publicDayPass', () => {
    it('delegates to service and returns wrapped response', async () => {
      const dto = {
        guestName: 'John',
        guestEmail: 'john@example.com',
        guestPhone: '+2348000000000',
        workspaceId: 'ws-1',
        date: '2026-06-22',
      };
      service.publicDayPass.mockResolvedValue({
        bookingId: 'b-1',
        authorizationUrl: 'https://paystack.com',
      } as any);

      const result = await controller.publicDayPass(dto);
      expect(result).toEqual({
        message: 'Day-pass booking initiated',
        data: { bookingId: 'b-1', authorizationUrl: 'https://paystack.com' },
      });
    });
  });

  describe('create', () => {
    it('delegates to service and returns wrapped response', async () => {
      const dto = { workspaceId: 'ws-1' } as any;
      service.create.mockResolvedValue({ id: 'booking-1' } as any);

      const result = await controller.create(dto, 'user-1');
      expect(result).toEqual({
        message: 'Booking created successfully',
        data: { id: 'booking-1' },
      });
      expect(service.create).toHaveBeenCalledWith(dto, 'user-1');
    });
  });

  describe('findAll', () => {
    it('returns bookings with message and result spread', async () => {
      const paginated = {
        data: [{ id: 'booking-1' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      service.findAll.mockResolvedValue(paginated as any);

      const result = await controller.findAll({} as any, 'user-1', UserRole.USER);
      expect(result).toEqual({
        message: 'Bookings retrieved successfully',
        ...paginated,
      });
      expect(service.findAll).toHaveBeenCalledWith({}, 'user-1', UserRole.USER);
    });
  });

  describe('getPriceEstimate', () => {
    it('returns calculated price estimate', async () => {
      service.calculatePrice.mockReturnValue(400000);
      service.getPlanSummary.mockReturnValue({ days: 1, discountPct: 0 });

      const result = await controller.getPriceEstimate(
        '50000',
        PlanType.DAILY,
        '1',
        '2024-01-01',
        '2024-01-01',
      );
      expect(result).toEqual({
        message: 'Price estimate calculated',
        data: { amountKobo: 400000, amountNaira: 4000, days: 1, discountPct: 0 },
      });
      expect(service.calculatePrice).toHaveBeenCalledWith(
        50000,
        PlanType.DAILY,
        1,
        '2024-01-01',
        '2024-01-01',
      );
    });
  });

  describe('findOne', () => {
    it('returns booking by id', async () => {
      service.findById.mockResolvedValue({ id: 'booking-1' } as any);

      const result = await controller.findOne('booking-1', 'user-1', UserRole.USER);
      expect(result).toEqual({
        message: 'Booking retrieved successfully',
        data: { id: 'booking-1' },
      });
      expect(service.findById).toHaveBeenCalledWith('booking-1', 'user-1', UserRole.USER);
    });
  });

  describe('confirm', () => {
    it('confirms booking', async () => {
      service.confirm.mockResolvedValue({ id: 'booking-1' } as any);

      const result = await controller.confirm('booking-1');
      expect(result).toEqual({
        message: 'Booking confirmed successfully',
        data: { id: 'booking-1' },
      });
      expect(service.confirm).toHaveBeenCalledWith('booking-1');
    });
  });

  describe('cancel', () => {
    it('cancels booking', async () => {
      service.cancel.mockResolvedValue({ id: 'booking-1' } as any);

      const result = await controller.cancel('booking-1', 'user-1', UserRole.USER);
      expect(result).toEqual({
        message: 'Booking cancelled successfully',
        data: { id: 'booking-1' },
      });
      expect(service.cancel).toHaveBeenCalledWith('booking-1', 'user-1', UserRole.USER);
    });
  });

  describe('complete', () => {
    it('completes booking', async () => {
      service.complete.mockResolvedValue({ id: 'booking-1' } as any);

      const result = await controller.complete('booking-1');
      expect(result).toEqual({
        message: 'Booking completed successfully',
        data: { id: 'booking-1' },
      });
      expect(service.complete).toHaveBeenCalledWith('booking-1');
    });
  });
});
