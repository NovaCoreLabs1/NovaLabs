import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: jest.Mocked<Partial<NotificationsService>>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: service }],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('returns paginated notifications with message', async () => {
      const paginated = {
        data: [{ id: 'notif-1', title: 'Test' }],
        total: 1,
        unreadCount: 0,
        page: 1,
        limit: 20,
      } as any;
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({} as any, 'user-1');
      expect(result).toEqual({
        message: 'Notifications retrieved successfully',
        ...paginated,
      });
      expect(service.findAll).toHaveBeenCalledWith('user-1', {});
    });
  });

  describe('markRead', () => {
    it('marks notification as read', async () => {
      service.markRead.mockResolvedValue(undefined);

      const result = await controller.markRead('notif-1', 'user-1');
      expect(result).toEqual({ message: 'Notification marked as read' });
      expect(service.markRead).toHaveBeenCalledWith('notif-1', 'user-1');
    });
  });

  describe('markAllRead', () => {
    it('marks all notifications as read', async () => {
      service.markAllRead.mockResolvedValue(undefined);

      const result = await controller.markAllRead('user-1');
      expect(result).toEqual({ message: 'All notifications marked as read' });
      expect(service.markAllRead).toHaveBeenCalledWith('user-1');
    });
  });
});
