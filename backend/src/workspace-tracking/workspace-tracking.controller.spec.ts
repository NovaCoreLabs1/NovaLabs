import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceTrackingController } from './workspace-tracking.controller';
import { WorkspaceTrackingService } from './workspace-tracking.service';

describe('WorkspaceTrackingController', () => {
  let controller: WorkspaceTrackingController;
  let service: jest.Mocked<Partial<WorkspaceTrackingService>>;

  beforeEach(async () => {
    service = {
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      getActiveCheckIn: jest.fn(),
      getCurrentOccupancy: jest.fn(),
      getUtilizationStats: jest.fn(),
      getRecentLogs: jest.fn(),
      getStorageAuditSummary: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspaceTrackingController],
      providers: [{ provide: WorkspaceTrackingService, useValue: service }],
    }).compile();

    controller = module.get<WorkspaceTrackingController>(
      WorkspaceTrackingController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─────────────────────────────────────
  // POST /check-in
  // ─────────────────────────────────────
  describe('checkIn', () => {
    it('delegates to service.checkIn and returns wrapped response', async () => {
      const dto = { workspaceId: 'ws-1' } as any;
      service.checkIn.mockResolvedValue({ id: 'log-1' } as any);

      const result = await controller.checkIn(dto, 'user-1');
      expect(result).toEqual({
        message: 'Checked in successfully',
        data: { id: 'log-1' },
      });
      expect(service.checkIn).toHaveBeenCalledWith(dto, 'user-1');
    });
  });

  // ─────────────────────────────────────
  // PATCH /check-out/:logId
  // ─────────────────────────────────────
  describe('checkOut', () => {
    it('delegates to service.checkOut and returns wrapped response', async () => {
      service.checkOut.mockResolvedValue({ id: 'log-1' } as any);

      const result = await controller.checkOut('log-1', 'user-1');
      expect(result).toEqual({
        message: 'Checked out successfully',
        data: { id: 'log-1' },
      });
      expect(service.checkOut).toHaveBeenCalledWith('log-1', 'user-1');
    });
  });

  // ─────────────────────────────────────
  // GET /active
  // ─────────────────────────────────────
  describe('getActiveCheckIn', () => {
    it('returns active check-in for user without workspaceId', async () => {
      service.getActiveCheckIn.mockResolvedValue({ id: 'log-1' } as any);

      const result = await controller.getActiveCheckIn('user-1');
      expect(result).toEqual({
        message: 'Active check-in retrieved',
        data: { id: 'log-1' },
      });
      expect(service.getActiveCheckIn).toHaveBeenCalledWith(
        'user-1',
        undefined,
      );
    });

    it('filters by workspaceId when provided', async () => {
      service.getActiveCheckIn.mockResolvedValue({ id: 'log-1' } as any);

      const result = await controller.getActiveCheckIn('user-1', 'ws-1');
      expect(result).toEqual({
        message: 'Active check-in retrieved',
        data: { id: 'log-1' },
      });
      expect(service.getActiveCheckIn).toHaveBeenCalledWith('user-1', 'ws-1');
    });
  });

  // ─────────────────────────────────────
  // GET /occupancy
  // ─────────────────────────────────────
  describe('getCurrentOccupancy', () => {
    it('returns occupancy for all workspaces', async () => {
      service.getCurrentOccupancy.mockResolvedValue([]);

      const result = await controller.getCurrentOccupancy();
      expect(result).toEqual({
        message: 'Occupancy retrieved',
        data: [],
      });
      expect(service.getCurrentOccupancy).toHaveBeenCalledWith(undefined);
    });

    it('filters by workspaceId when provided', async () => {
      service.getCurrentOccupancy.mockResolvedValue([]);

      await controller.getCurrentOccupancy('ws-1');
      expect(service.getCurrentOccupancy).toHaveBeenCalledWith('ws-1');
    });
  });

  // ─────────────────────────────────────
  // GET /utilization
  // ─────────────────────────────────────
  describe('getUtilizationStats', () => {
    it('returns utilization stats', async () => {
      const query = { from: '2024-01-01' } as any;
      service.getUtilizationStats.mockResolvedValue([]);

      const result = await controller.getUtilizationStats(query);
      expect(result).toEqual({
        message: 'Utilization stats retrieved',
        data: [],
      });
      expect(service.getUtilizationStats).toHaveBeenCalledWith(query);
    });
  });

  // ─────────────────────────────────────
  // GET /logs
  // ─────────────────────────────────────
  describe('getRecentLogs', () => {
    it('returns recent logs with default limit', async () => {
      service.getRecentLogs.mockResolvedValue([]);

      const result = await controller.getRecentLogs();
      expect(result).toEqual({
        message: 'Recent logs retrieved',
        data: [],
      });
      expect(service.getRecentLogs).toHaveBeenCalledWith(undefined, 50);
    });

    it('passes limit as number when provided as string', async () => {
      service.getRecentLogs.mockResolvedValue([]);

      await controller.getRecentLogs('ws-1', '10');
      expect(service.getRecentLogs).toHaveBeenCalledWith('ws-1', 10);
    });
  });

  // ─────────────────────────────────────
  // GET /audit/storage-summary
  // ─────────────────────────────────────
  describe('getStorageAuditSummary', () => {
    it('returns storage audit summary', async () => {
      const summary = { totalLogs: 5 } as any;
      service.getStorageAuditSummary.mockResolvedValue(summary);

      const result = await controller.getStorageAuditSummary();
      expect(result).toEqual({
        message: 'Biometric storage audit summary retrieved',
        data: summary,
      });
      expect(service.getStorageAuditSummary).toHaveBeenCalled();
    });
  });
});
