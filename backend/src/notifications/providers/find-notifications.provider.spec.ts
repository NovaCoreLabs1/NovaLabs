import { FindNotificationsProvider } from './find-notifications.provider';

describe('FindNotificationsProvider', () => {
  let provider: FindNotificationsProvider;
  let notificationsRepository: any;

  beforeEach(() => {
    notificationsRepository = {
      createQueryBuilder: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    };
    provider = new FindNotificationsProvider(notificationsRepository);
  });

  function mockQueryBuilder(overrides: any = {}) {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest
        .fn()
        .mockResolvedValue([overrides.data ?? [], overrides.total ?? 0]),
    };
    notificationsRepository.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  describe('findAll', () => {
    it('returns paginated notifications for a user', async () => {
      mockQueryBuilder({
        total: 2,
        data: [
          { id: 'notif-1', title: 'First' },
          { id: 'notif-2', title: 'Second' },
        ],
      });
      notificationsRepository.count.mockResolvedValue(1);

      const result = await provider.findAll('user-1', {});

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.unreadCount).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('filters by isRead status when provided', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });
      notificationsRepository.count.mockResolvedValue(0);

      await provider.findAll('user-1', { isRead: true });

      expect(qb.andWhere).toHaveBeenCalledWith('n.isRead = :isRead', {
        isRead: true,
      });
    });

    it('applies pagination correctly', async () => {
      const qb = mockQueryBuilder({ total: 25, data: [] });
      notificationsRepository.count.mockResolvedValue(5);

      const result = await provider.findAll('user-1', { page: 2, limit: 10 });

      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });

    it('caps limit to 100', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });
      notificationsRepository.count.mockResolvedValue(0);

      await provider.findAll('user-1', { limit: 500 });

      expect(qb.take).toHaveBeenCalledWith(100);
    });

    it('returns empty result when no notifications', async () => {
      mockQueryBuilder({ total: 0, data: [] });
      notificationsRepository.count.mockResolvedValue(0);

      const result = await provider.findAll('user-1', {});

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.unreadCount).toBe(0);
    });
  });

  describe('markRead', () => {
    it('marks a notification as read with ownership check', async () => {
      notificationsRepository.update.mockResolvedValue({ affected: 1 });

      await provider.markRead('notif-1', 'user-1');

      expect(notificationsRepository.update).toHaveBeenCalledWith(
        { id: 'notif-1', userId: 'user-1' },
        { isRead: true },
      );
    });
  });

  describe('markAllRead', () => {
    it('marks all unread notifications as read for the user', async () => {
      notificationsRepository.update.mockResolvedValue({ affected: 5 });

      await provider.markAllRead('user-1');

      expect(notificationsRepository.update).toHaveBeenCalledWith(
        { userId: 'user-1', isRead: false },
        { isRead: true },
      );
    });
  });
});
