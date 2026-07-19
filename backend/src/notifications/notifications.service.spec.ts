import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { CreateNotificationProvider } from './providers/create-notification.provider';
import { FindNotificationsProvider } from './providers/find-notifications.provider';
import { NotificationType } from './enums/notification-type.enum';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let createProvider: jest.Mocked<Partial<CreateNotificationProvider>>;
  let findProvider: jest.Mocked<Partial<FindNotificationsProvider>>;

  beforeEach(async () => {
    createProvider = { create: jest.fn() };
    findProvider = {
      findAll: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: CreateNotificationProvider, useValue: createProvider },
        { provide: FindNotificationsProvider, useValue: findProvider },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('create', () => {
    it('delegates to CreateNotificationProvider', async () => {
      const input = {
        userId: 'user-1',
        type: NotificationType.GENERAL,
        title: 'Test',
        message: 'Hello',
      };
      createProvider.create.mockResolvedValue({
        id: 'notif-1',
        ...input,
      } as any);

      const result = await service.create(input);
      expect(result).toEqual({ id: 'notif-1', ...input });
      expect(createProvider.create).toHaveBeenCalledWith(input);
    });
  });

  describe('findAll', () => {
    it('delegates to FindNotificationsProvider', async () => {
      findProvider.findAll.mockResolvedValue({
        data: [],
        total: 0,
        unreadCount: 0,
        page: 1,
        limit: 20,
      });

      const result = await service.findAll('user-1', {});
      expect(result.total).toBe(0);
      expect(findProvider.findAll).toHaveBeenCalledWith('user-1', {});
    });
  });

  describe('markRead', () => {
    it('delegates to FindNotificationsProvider', async () => {
      findProvider.markRead.mockResolvedValue(undefined);

      await service.markRead('notif-1', 'user-1');
      expect(findProvider.markRead).toHaveBeenCalledWith('notif-1', 'user-1');
    });
  });

  describe('markAllRead', () => {
    it('delegates to FindNotificationsProvider', async () => {
      findProvider.markAllRead.mockResolvedValue(undefined);

      await service.markAllRead('user-1');
      expect(findProvider.markAllRead).toHaveBeenCalledWith('user-1');
    });
  });
});
