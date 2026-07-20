import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './providers/audit-log.service';
import { UserRole } from '../users/enums/userRoles.enum';

describe('AuditLogController', () => {
  let controller: AuditLogController;
  let service: jest.Mocked<Partial<AuditLogService>>;

  const mockPaginatedResult = {
    data: [
      {
        id: 'log-1',
        actorId: 'user-1',
        actorEmail: 'admin@example.com',
        actorRole: 'admin',
        action: 'users.create',
        targetType: 'user',
        targetId: 'target-1',
        createdAt: new Date('2024-01-15'),
      },
      {
        id: 'log-2',
        actorId: 'user-1',
        actorEmail: 'admin@example.com',
        actorRole: 'admin',
        action: 'workspaces.update',
        targetType: 'workspace',
        targetId: 'ws-1',
        createdAt: new Date('2024-01-14'),
      },
    ],
    total: 2,
    page: 1,
    limit: 20,
    totalPages: 1,
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [{ provide: AuditLogService, useValue: service }],
    }).compile();

    controller = module.get<AuditLogController>(AuditLogController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('returns paginated audit logs with metadata for admin user', async () => {
      service.findAll.mockResolvedValue(mockPaginatedResult as any);

      const filter = {
        page: 1,
        limit: 20,
        targetType: 'user',
      };

      const result = await controller.findAll(
        filter as any,
        'admin-1',
        UserRole.ADMIN,
      );

      expect(service.findAll).toHaveBeenCalledWith(
        filter,
        'admin-1',
        UserRole.ADMIN,
      );
      expect(result).toEqual({
        message: 'Audit logs retrieved successfully',
        data: mockPaginatedResult.data,
        meta: {
          currentPage: 1,
          itemsPerPage: 20,
          totalItems: 2,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        },
        totalAmount: '2',
      });
    });

    it('delegates filter params to service', async () => {
      service.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      } as any);

      const filter = {
        actorId: 'specific-user',
        action: 'users.create',
        targetType: 'workspace',
        targetId: 'ws-1',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        search: 'admin',
        page: 2,
        limit: 10,
      };

      await controller.findAll(filter as any, 'admin-1', UserRole.SUPER_ADMIN);

      expect(service.findAll).toHaveBeenCalledWith(
        filter,
        'admin-1',
        UserRole.SUPER_ADMIN,
      );
    });

    it('handles empty results', async () => {
      service.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      } as any);

      const result = await controller.findAll(
        {} as any,
        'user-1',
        UserRole.USER,
      );

      expect(result.meta).toEqual({
        currentPage: 1,
        itemsPerPage: 20,
        totalItems: 0,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      });
      expect(result.data).toEqual([]);
      expect(result.totalAmount).toBe('0');
    });

    it('computes hasNextPage correctly when on first page of many', async () => {
      service.findAll.mockResolvedValue({
        data: [{ id: 'log-1' }],
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3,
      } as any);

      const result = await controller.findAll(
        { page: 1, limit: 10 } as any,
        'admin-1',
        UserRole.ADMIN,
      );

      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.hasPreviousPage).toBe(false);
    });

    it('computes hasPreviousPage correctly when on last page', async () => {
      service.findAll.mockResolvedValue({
        data: [{ id: 'log-5' }],
        total: 25,
        page: 3,
        limit: 10,
        totalPages: 3,
      } as any);

      const result = await controller.findAll(
        { page: 3, limit: 10 } as any,
        'admin-1',
        UserRole.ADMIN,
      );

      expect(result.meta.hasPreviousPage).toBe(true);
      expect(result.meta.hasNextPage).toBe(false);
    });
  });
});
