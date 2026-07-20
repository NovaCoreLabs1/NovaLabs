import { Test, TestingModule } from '@nestjs/testing';
import { NewsletterService } from './newsletter.service';
import { NewsletterProvider } from './providers/subscription.provider';
import { ListNewsletterSubscribersProvider } from './providers/list-subscribers.provider';

describe('NewsletterService', () => {
  let service: NewsletterService;
  let subscriptionProvider: any;
  let listSubscribersProvider: any;

  beforeEach(async () => {
    subscriptionProvider = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      confirm: jest.fn(),
    };
    listSubscribersProvider = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsletterService,
        { provide: NewsletterProvider, useValue: subscriptionProvider },
        {
          provide: ListNewsletterSubscribersProvider,
          useValue: listSubscribersProvider,
        },
      ],
    }).compile();

    service = module.get<NewsletterService>(NewsletterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('subscribe', () => {
    it('delegates to NewsletterProvider', async () => {
      const result = {
        id: 'sub-1',
        email: 'alice@example.com',
        subscribedAt: new Date(),
        isActive: false,
      };
      subscriptionProvider.subscribe.mockResolvedValue(result);

      const response = await service.subscribe(
        'alice@example.com',
        '192.168.1.1',
      );

      expect(response).toEqual(result);
      expect(subscriptionProvider.subscribe).toHaveBeenCalledWith({
        email: 'alice@example.com',
        ipAddress: '192.168.1.1',
      });
    });

    it('passes null IP when not provided', async () => {
      subscriptionProvider.subscribe.mockResolvedValue({});

      await service.subscribe('alice@example.com');

      expect(subscriptionProvider.subscribe).toHaveBeenCalledWith({
        email: 'alice@example.com',
        ipAddress: undefined,
      });
    });
  });

  describe('confirm', () => {
    it('delegates to NewsletterProvider', async () => {
      subscriptionProvider.confirm.mockResolvedValue({
        success: true,
        message: 'Confirmed.',
      });

      const result = await service.confirm('token-123');

      expect(result).toEqual({ success: true, message: 'Confirmed.' });
      expect(subscriptionProvider.confirm).toHaveBeenCalledWith({
        token: 'token-123',
      });
    });
  });

  describe('unsubscribe', () => {
    it('delegates to NewsletterProvider', async () => {
      subscriptionProvider.unsubscribe.mockResolvedValue({
        success: true,
        message: 'Unsubscribed.',
      });

      const result = await service.unsubscribe('unsub-token');

      expect(result).toEqual({ success: true, message: 'Unsubscribed.' });
      expect(subscriptionProvider.unsubscribe).toHaveBeenCalledWith({
        token: 'unsub-token',
      });
    });
  });

  describe('listSubscribers', () => {
    it('delegates to ListNewsletterSubscribersProvider', async () => {
      const paginated = { items: [], meta: {} };
      listSubscribersProvider.execute.mockResolvedValue(paginated);

      const result = await service.listSubscribers({ page: 1, perPage: 10 });

      expect(result).toEqual(paginated);
      expect(listSubscribersProvider.execute).toHaveBeenCalledWith({
        page: 1,
        perPage: 10,
      });
    });
  });
});
