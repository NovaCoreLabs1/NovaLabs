import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceTrackingService } from './workspace-tracking.service';
import { CheckInProvider } from './providers/check-in.provider';
import { OccupancyProvider } from './providers/occupancy.provider';

describe('WorkspaceTrackingService', () => {
  let service: WorkspaceTrackingService;
  let checkInProvider: jest.Mocked<Partial<CheckInProvider>>;
  let occupancyProvider: jest.Mocked<Partial<OccupancyProvider>>;

  beforeEach(async () => {
    checkInProvider = {
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      getActiveCheckIn: jest.fn(),
      getStorageAuditSummary: jest.fn(),
    };

    occupancyProvider = {
      getCurrentOccupancy: jest.fn(),
      getUtilizationStats: jest.fn(),
      getRecentLogs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceTrackingService,
        { provide: CheckInProvider, useValue: checkInProvider },
        { provide: OccupancyProvider, useValue: occupancyProvider },
      ],
    }).compile();

    service = module.get<WorkspaceTrackingService>(WorkspaceTrackingService);
  });

  // ─────────────────────────────────────
  // Delegation to CheckInProvider
  // ─────────────────────────────────────
  describe('checkIn', () => {
    it('delegates to CheckInProvider.checkIn', async () => {
      const dto = { workspaceId: 'ws-1' } as any;
      checkInProvider.checkIn.mockResolvedValue({ id: 'log-1' } as any);

      const result = await service.checkIn(dto, 'user-1');
      expect(result).toEqual({ id: 'log-1' });
      expect(checkInProvider.checkIn).toHaveBeenCalledWith(dto, 'user-1');
    });
  });

  describe('checkOut', () => {
    it('delegates to CheckInProvider.checkOut', async () => {
      checkInProvider.checkOut.mockResolvedValue({ id: 'log-1' } as any);

      const result = await service.checkOut('log-1', 'user-1');
      expect(result).toEqual({ id: 'log-1' });
      expect(checkInProvider.checkOut).toHaveBeenCalledWith('log-1', 'user-1');
    });
  });

  describe('getActiveCheckIn', () => {
    it('delegates to CheckInProvider.getActiveCheckIn', async () => {
      checkInProvider.getActiveCheckIn.mockResolvedValue({ id: 'log-1' } as any);

      const result = await service.getActiveCheckIn('user-1', 'ws-1');
      expect(result).toEqual({ id: 'log-1' });
      expect(checkInProvider.getActiveCheckIn).toHaveBeenCalledWith(
        'user-1',
        'ws-1',
      );
    });

    it('works without workspaceId', async () => {
      checkInProvider.getActiveCheckIn.mockResolvedValue(null);

      const result = await service.getActiveCheckIn('user-1');
      expect(result).toBeNull();
      expect(checkInProvider.getActiveCheckIn).toHaveBeenCalledWith(
        'user-1',
        undefined,
      );
    });
  });

  describe('getStorageAuditSummary', () => {
    it('delegates to CheckInProvider.getStorageAuditSummary', async () => {
      const summary = { totalLogs: 5 } as any;
      checkInProvider.getStorageAuditSummary.mockResolvedValue(summary);

      const result = await service.getStorageAuditSummary();
      expect(result).toEqual(summary);
      expect(checkInProvider.getStorageAuditSummary).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────
  // Delegation to OccupancyProvider
  // ─────────────────────────────────────
  describe('getCurrentOccupancy', () => {
    it('delegates to OccupancyProvider.getCurrentOccupancy', async () => {
      occupancyProvider.getCurrentOccupancy.mockResolvedValue([]);

      const result = await service.getCurrentOccupancy();
      expect(result).toEqual([]);
      expect(occupancyProvider.getCurrentOccupancy).toHaveBeenCalledWith(
        undefined,
      );
    });

    it('passes workspaceId when provided', async () => {
      occupancyProvider.getCurrentOccupancy.mockResolvedValue([]);

      await service.getCurrentOccupancy('ws-1');
      expect(occupancyProvider.getCurrentOccupancy).toHaveBeenCalledWith(
        'ws-1',
      );
    });
  });

  describe('getUtilizationStats', () => {
    it('delegates to OccupancyProvider.getUtilizationStats', async () => {
      const query = { from: '2024-01-01' } as any;
      occupancyProvider.getUtilizationStats.mockResolvedValue([]);

      const result = await service.getUtilizationStats(query);
      expect(result).toEqual([]);
      expect(occupancyProvider.getUtilizationStats).toHaveBeenCalledWith(query);
    });
  });

  describe('getRecentLogs', () => {
    it('delegates to OccupancyProvider.getRecentLogs', async () => {
      occupancyProvider.getRecentLogs.mockResolvedValue([{ id: 'log-1' }] as any);

      const result = await service.getRecentLogs('ws-1', 20);
      expect(result).toEqual([{ id: 'log-1' }]);
      expect(occupancyProvider.getRecentLogs).toHaveBeenCalledWith('ws-1', 20);
    });

    it('passes default limit of undefined', async () => {
      occupancyProvider.getRecentLogs.mockResolvedValue([]);

      await service.getRecentLogs();
      expect(occupancyProvider.getRecentLogs).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
    });
  });
});
