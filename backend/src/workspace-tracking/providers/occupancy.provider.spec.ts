import { OccupancyProvider } from './occupancy.provider';

describe('OccupancyProvider', () => {
  let provider: OccupancyProvider;
  let logsRepository: any;
  let workspacesRepository: any;

  beforeEach(() => {
    logsRepository = {
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    workspacesRepository = {
      createQueryBuilder: jest.fn(),
    };

    provider = new OccupancyProvider(logsRepository, workspacesRepository);
  });

  // ─────────────────────────────────────
  // getCurrentOccupancy
  // ─────────────────────────────────────
  describe('getCurrentOccupancy', () => {
    it('returns occupancy for all active workspaces', async () => {
      // Mock workspace query builder
      const workspaceQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'ws-1', name: 'Main Hall', totalSeats: 50 },
          { id: 'ws-2', name: 'Quiet Room', totalSeats: 10 },
        ]),
      };
      workspacesRepository.createQueryBuilder.mockReturnValue(workspaceQb);

      // Mock occupancy counts
      logsRepository.count
        .mockResolvedValueOnce(5) // ws-1 occupancy
        .mockResolvedValueOnce(2); // ws-2 occupancy

      const result = await provider.getCurrentOccupancy();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        workspaceId: 'ws-1',
        workspaceName: 'Main Hall',
        totalSeats: 50,
        currentOccupancy: 5,
        utilizationPercent: 10,
      });
      expect(result[1]).toEqual({
        workspaceId: 'ws-2',
        workspaceName: 'Quiet Room',
        totalSeats: 10,
        currentOccupancy: 2,
        utilizationPercent: 20,
      });
    });

    it('filters by workspaceId when provided', async () => {
      const workspaceQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'ws-1', name: 'Main Hall', totalSeats: 50 },
          ]),
      };
      workspacesRepository.createQueryBuilder.mockReturnValue(workspaceQb);
      logsRepository.count.mockResolvedValueOnce(5);

      await provider.getCurrentOccupancy('ws-1');

      expect(workspaceQb.andWhere).toHaveBeenCalledWith(
        'ws.id = :workspaceId',
        { workspaceId: 'ws-1' },
      );
    });

    it('handles workspace with zero totalSeats (utilization 0)', async () => {
      const workspaceQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'ws-3', name: 'Open Area', totalSeats: 0 },
          ]),
      };
      workspacesRepository.createQueryBuilder.mockReturnValue(workspaceQb);
      logsRepository.count.mockResolvedValueOnce(0);

      const result = await provider.getCurrentOccupancy();
      expect(result[0].utilizationPercent).toBe(0);
    });

    it('returns empty array when no active workspaces exist', async () => {
      const workspaceQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      workspacesRepository.createQueryBuilder.mockReturnValue(workspaceQb);

      const result = await provider.getCurrentOccupancy();
      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────
  // getUtilizationStats
  // ─────────────────────────────────────
  describe('getUtilizationStats', () => {
    function mockQueryBuilder(rawRows: any[]) {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rawRows),
      };
      logsRepository.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    it('returns empty stats when no completed check-ins exist', async () => {
      mockQueryBuilder([]);

      const result = await provider.getUtilizationStats({});
      expect(result).toEqual([]);
    });

    it('aggregates stats across workspaces', async () => {
      const qb = mockQueryBuilder([
        {
          workspaceId: 'ws-1',
          totalVisits: '10',
          uniqueUsers: '3',
          avgDurationMinutes: '45',
          totalHours: '7.5',
        },
        {
          workspaceId: 'ws-2',
          totalVisits: '5',
          uniqueUsers: '2',
          avgDurationMinutes: '60',
          totalHours: '5.0',
        },
      ]);

      // Mock workspace name lookup
      const workspaceQb = {
        whereInIds: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'ws-1', name: 'Main Hall' },
          { id: 'ws-2', name: 'Quiet Room' },
        ]),
      };
      workspacesRepository.createQueryBuilder.mockReturnValue(workspaceQb);

      const result = await provider.getUtilizationStats({});
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        workspaceId: 'ws-1',
        workspaceName: 'Main Hall',
        totalVisits: 10,
        uniqueUsers: 3,
        avgDurationMinutes: 45,
        totalHours: 7.5,
      });
      expect(result[1]).toEqual({
        workspaceId: 'ws-2',
        workspaceName: 'Quiet Room',
        totalVisits: 5,
        uniqueUsers: 2,
        avgDurationMinutes: 60,
        totalHours: 5,
      });
    });

    it('applies workspaceId filter', async () => {
      const qb = mockQueryBuilder([]);
      await provider.getUtilizationStats({ workspaceId: 'ws-1' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'log.workspaceId = :workspaceId',
        { workspaceId: 'ws-1' },
      );
    });

    it('applies date range filters', async () => {
      const qb = mockQueryBuilder([]);
      await provider.getUtilizationStats({
        from: '2024-01-01',
        to: '2024-01-31',
      });

      expect(qb.andWhere).toHaveBeenCalledWith('log.checkedInAt >= :from', {
        from: '2024-01-01',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('log.checkedInAt < :to', {
        to: expect.stringMatching(/2024-02-0?1/),
      });
    });

    it('sets workspace name to Unknown when workspace not found', async () => {
      mockQueryBuilder([
        {
          workspaceId: 'ws-999',
          totalVisits: '1',
          uniqueUsers: '1',
          avgDurationMinutes: '30',
          totalHours: '0.5',
        },
      ]);

      const workspaceQb = {
        whereInIds: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      workspacesRepository.createQueryBuilder.mockReturnValue(workspaceQb);

      const result = await provider.getUtilizationStats({});
      expect(result[0].workspaceName).toBe('Unknown');
    });
  });

  // ─────────────────────────────────────
  // getRecentLogs
  // ─────────────────────────────────────
  describe('getRecentLogs', () => {
    function createQb() {
      const qb = {
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      };
      logsRepository.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    it('returns recent logs with default limit of 50', async () => {
      const qb = createQb();
      qb.getMany.mockResolvedValue([{ id: 'log-1' }]);

      const result = await provider.getRecentLogs();
      expect(result).toEqual([{ id: 'log-1' }]);
      expect(qb.orderBy).toHaveBeenCalledWith('log.checkedInAt', 'DESC');
      expect(qb.take).toHaveBeenCalledWith(50);
    });

    it('accepts a custom limit', async () => {
      const qb = createQb();
      qb.getMany.mockResolvedValue([{ id: 'log-1' }]);

      await provider.getRecentLogs(undefined, 10);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('filters by workspaceId when provided', async () => {
      const qb = createQb();
      qb.getMany.mockResolvedValue([]);

      await provider.getRecentLogs('ws-1', 20);
      expect(qb.where).toHaveBeenCalledWith('log.workspaceId = :workspaceId', {
        workspaceId: 'ws-1',
      });
    });

    it('returns empty array when no logs exist', async () => {
      const qb = createQb();
      qb.getMany.mockResolvedValue([]);

      const result = await provider.getRecentLogs();
      expect(result).toEqual([]);
    });
  });
});
