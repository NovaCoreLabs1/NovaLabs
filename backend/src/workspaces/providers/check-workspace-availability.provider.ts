import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Workspace } from '../entities/workspace.entity';
import { FindWorkspaceByIdProvider } from './find-workspace-by-id.provider';
import {
  QuerySource,
  SeatAvailabilityProvider,
} from './seat-availability.provider';

export interface AvailabilityResult {
  available: boolean;
  availableSeats: number;
  totalSeats: number;
  message?: string;
}

/** Inclusive booking window the availability is computed for. */
export interface AvailabilityWindow {
  startDate: string;
  endDate: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reports seat availability derived from the same live overlap query
 * that booking creation enforces (PENDING + CONFIRMED bookings holding
 * seats on the window). The former stored `Workspace.availableSeats`
 * counter was never written by any booking path and could disagree
 * with reality; it has been removed (issue #229).
 */
@Injectable()
export class CheckWorkspaceAvailabilityProvider {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspacesRepository: Repository<Workspace>,
    private readonly findWorkspaceByIdProvider: FindWorkspaceByIdProvider,
    private readonly seatAvailabilityProvider: SeatAvailabilityProvider,
    private readonly dataSource: DataSource,
  ) {}

  async check(
    workspaceId: string,
    requestedSeats: number = 1,
    window?: Partial<AvailabilityWindow>,
    source: QuerySource = this.dataSource.manager,
  ): Promise<AvailabilityResult> {
    if (!Number.isInteger(requestedSeats) || requestedSeats < 1) {
      throw new BadRequestException(
        'requestedSeats must be a positive integer',
      );
    }

    const resolved = this.resolveWindow(window);

    const workspace =
      await this.findWorkspaceByIdProvider.findById(workspaceId);

    if (!workspace.isActive) {
      return {
        available: false,
        availableSeats: 0,
        totalSeats: workspace.totalSeats,
        message: 'Workspace is not active',
      };
    }

    const availableSeats = await this.seatAvailabilityProvider.availableSeats(
      source,
      workspaceId,
      workspace.totalSeats,
      resolved.startDate,
      resolved.endDate,
    );

    const available = availableSeats >= requestedSeats;
    return {
      available,
      availableSeats,
      totalSeats: workspace.totalSeats,
      message: available ? undefined : `Only ${availableSeats} seats available`,
    };
  }

  /**
   * Defaults to "today" so callers without an explicit window get the
   * same day-scoped answer the endpoint has always given, while callers
   * can pass any inclusive date range.
   */
  private resolveWindow(
    window?: Partial<AvailabilityWindow>,
  ): AvailabilityWindow {
    const startDate = window?.startDate ?? this.today();
    const endDate = window?.endDate ?? startDate;

    if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
      throw new BadRequestException('Dates must be YYYY-MM-DD strings');
    }
    if (startDate > endDate) {
      throw new BadRequestException('startDate must not be after endDate');
    }

    return { startDate, endDate };
  }

  private today(): string {
    return new Date().toISOString().split('T')[0];
  }
}
