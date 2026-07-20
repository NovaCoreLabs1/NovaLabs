import { FindAuditLogsProvider } from './find-audit-logs.provider';
import { UserRole } from '../../users/enums/userRoles.enum';

describe('FindAuditLogsProvider', () => {
  let provider: FindAuditLogsProvider;
  let auditLogRepository: any;

  beforeEach(async () => {
    auditLogRepository = {
      createQueryBuilder: jest.fn(),
    };
    provider = new FindAuditLogsProvider(auditLogRepository);
  });

  function mockQueryBuilder(overrides: any = {}) {
    const qb = {
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(overrides.total ?? 0),
      getMany: jest.fn().mockResolvedValue(overrides.data ?? []),
    };
    auditLogRepository.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  describe('findAll', () => {
    it('returns paginated audit logs for admin', async () => {
      mockQueryBuilder({
        total: 2,
        data: [{ id: 'log-1' }, { id: 'log-2' }],
      });

      const result = await provider.findAll({}, 'admin-1', UserRole.ADMIN);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('forces actorId to requestingUserId for non-admin users', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll({}, 'user-1', UserRole.USER);

      expect(qb.andWhere).toHaveBeenCalledWith('auditLog.actorId = :actorId', {
        actorId: 'user-1',
      });
    });

    it('allows admins to filter by specific actorId', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll(
        { actorId: 'specific-user' },
        'admin-1',
        UserRole.ADMIN,
      );

      expect(qb.andWhere).toHaveBeenCalledWith('auditLog.actorId = :actorId', {
        actorId: 'specific-user',
      });
    });

    it('applies action filter', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll(
        { action: 'users.create' },
        'admin-1',
        UserRole.ADMIN,
      );

      expect(qb.andWhere).toHaveBeenCalledWith('auditLog.action = :action', {
        action: 'users.create',
      });
    });

    it('applies targetType filter', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll(
        { targetType: 'workspace' },
        'admin-1',
        UserRole.ADMIN,
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        'auditLog.targetType = :targetType',
        { targetType: 'workspace' },
      );
    });

    it('applies date range filters', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll(
        { dateFrom: '2024-01-01', dateTo: '2024-01-31' },
        'admin-1',
        UserRole.ADMIN,
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        'auditLog.createdAt >= :dateFrom',
        { dateFrom: '2024-01-01' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'auditLog.createdAt <= :dateTo',
        { dateTo: '2024-01-31' },
      );
    });

    it('applies search filter with ILIKE', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll({ search: 'admin' }, 'admin-1', UserRole.ADMIN);

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(auditLog.actorEmail ILIKE :search OR auditLog.targetType ILIKE :search OR auditLog.action ILIKE :search)',
        { search: '%admin%' },
      );
    });

    it('applies pagination', async () => {
      const qb = mockQueryBuilder({ total: 25, data: [] });

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
});
