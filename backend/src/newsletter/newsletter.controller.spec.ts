import { Test, TestingModule } from '@nestjs/testing';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';

describe('NewsletterController', () => {
  let controller: NewsletterController;
  let newsletterService: any;

  beforeEach(async () => {
    newsletterService = {
      subscribe: jest.fn(),
      confirm: jest.fn(),
      unsubscribe: jest.fn(),
      listSubscribers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NewsletterController],
      providers: [{ provide: NewsletterService, useValue: newsletterService }],
    }).compile();

    controller = module.get<NewsletterController>(NewsletterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('subscribe', () => {
    it('subscribes email and returns success response', async () => {
      const dto = { email: 'alice@example.com' };
      const serviceResult = {
        id: 'sub-1',
        email: 'alice@example.com',
        subscribedAt: new Date(),
        isActive: false,
      };
      newsletterService.subscribe.mockResolvedValue(serviceResult);

      const req = { ip: '192.168.1.1', headers: {} };
      const result = await controller.subscribe(dto, req);

      expect(result).toEqual({
        success: true,
        message: 'Subscribed successfully.',
        data: serviceResult,
      });
      expect(newsletterService.subscribe).toHaveBeenCalledWith(
        'alice@example.com',
        '192.168.1.1',
      );
    });

    it('extracts IP from x-forwarded-for header', async () => {
      newsletterService.subscribe.mockResolvedValue({});

      const req = {
        ip: '10.0.0.1',
        headers: { 'x-forwarded-for': '203.0.113.5' },
      };
      await controller.subscribe({ email: 'test@test.com' }, req);

      expect(newsletterService.subscribe).toHaveBeenCalledWith(
        'test@test.com',
        '203.0.113.5',
      );
    });

    it('passes null when IP is missing', async () => {
      newsletterService.subscribe.mockResolvedValue({});

      const req = { headers: {} };
      await controller.subscribe({ email: 'test@test.com' }, req);

      expect(newsletterService.subscribe).toHaveBeenCalledWith(
        'test@test.com',
        null,
      );
    });
  });

  describe('confirm', () => {
    it('confirms subscription', async () => {
      newsletterService.confirm.mockResolvedValue({
        success: true,
        message: 'Subscription confirmed successfully.',
      });

      const result = await controller.confirm({ token: 'confirm-token' });

      expect(newsletterService.confirm).toHaveBeenCalledWith('confirm-token');
    });
  });

  describe('unsubscribe', () => {
    it('unsubscribes email', async () => {
      newsletterService.unsubscribe.mockResolvedValue({
        success: true,
        message: 'Unsubscribed successfully.',
      });

      const result = await controller.unsubscribe({ token: 'unsub-token' });

      expect(newsletterService.unsubscribe).toHaveBeenCalledWith('unsub-token');
    });
  });

  describe('listSubscribers', () => {
    it('returns paginated subscribers list', async () => {
      const subscribers = {
        items: [],
        meta: { currentPage: 1, totalItems: 0 },
      };
      newsletterService.listSubscribers.mockResolvedValue(subscribers);

      const result = await controller.listSubscribers({ page: 1, perPage: 10 });

      expect(newsletterService.listSubscribers).toHaveBeenCalledWith({
        page: 1,
        perPage: 10,
      });
    });
  });
});
