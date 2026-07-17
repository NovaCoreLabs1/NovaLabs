import { Injectable } from '@nestjs/common';
import { CheckInProvider } from './providers/check-in.provider';
import { OccupancyProvider } from './providers/occupancy.provider';
import { CheckInDto } from './dto/check-in.dto';
import { OccupancyQueryDto } from './dto/occupancy-query.dto';

@Injectable()
export class WorkspaceTrackingService {
  constructor(
    private readonly checkInProvider: CheckInProvider,
    private readonly occupancyProvider: OccupancyProvider,
  ) {}

  /**
   * Records a check-in for the authenticated user at the specified workspace.
   * @param dto - Check-in payload including workspaceId and optional seat info
   * @param userId - ID of the user checking in
   */
  checkIn(dto: CheckInDto, userId: string) {
    return this.checkInProvider.checkIn(dto, userId);
  }

  /**
   * Records a check-out for the given log entry.
   * @param logId - UUID of the workspace log to close
   * @param userId - ID of the user checking out
   */
  checkOut(logId: string, userId: string) {
    return this.checkInProvider.checkOut(logId, userId);
  }

  /**
   * Returns the currently active check-in for a user, optionally filtered by workspace.
   * @param userId - ID of the user
   * @param workspaceId - Optional workspace UUID to filter by
   */
  getActiveCheckIn(userId: string, workspaceId?: string) {
    return this.checkInProvider.getActiveCheckIn(userId, workspaceId);
  }

  /**
   * Returns the current occupancy count for all workspaces, or a single workspace.
   * @param workspaceId - Optional workspace UUID to filter
   */
  getCurrentOccupancy(workspaceId?: string) {
    return this.occupancyProvider.getCurrentOccupancy(workspaceId);
  }

  /**
   * Returns utilization statistics over a date range.
   * @param query - Date range and optional workspace filter
   */
  getUtilizationStats(query: OccupancyQueryDto) {
    return this.occupancyProvider.getUtilizationStats(query);
  }

  /**
   * Returns the most recent check-in logs for admin/staff review.
   * @param workspaceId - Optional workspace UUID to filter
   * @param limit - Max number of logs to return (defaults to 50)
   */
  getRecentLogs(workspaceId?: string, limit?: number) {
    return this.occupancyProvider.getRecentLogs(workspaceId, limit);
  }

  /**
   * Returns a privacy-focused storage summary for biometric check-in data.
   */
  getStorageAuditSummary() {
    return this.checkInProvider.getStorageAuditSummary();
  }
}
