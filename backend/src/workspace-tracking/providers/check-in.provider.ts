import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { WorkspaceLog } from '../entities/workspace-log.entity';
import { CheckInDto } from '../dto/check-in.dto';
import { Workspace } from '../../workspaces/entities/workspace.entity';

export interface BiometricStorageAuditSummary {
  totalLogs: number;
  logsWithHashedTemplates: number;
  logsWithOpaqueStorageRefs: number;
  rawBiometricRows: number;
  storagePolicy: string;
  recommendedProcessing: string;
}

@Injectable()
export class CheckInProvider {
  constructor(
    @InjectRepository(WorkspaceLog)
    private readonly logsRepository: Repository<WorkspaceLog>,
    @InjectRepository(Workspace)
    private readonly workspacesRepository: Repository<Workspace>,
  ) {}

  private validateBiometricPrivacy(dto: CheckInDto): void {
    const deniedFields = [
      'biometricTemplate',
      'biometricTemplateData',
      'biometricSample',
      'biometricPayload',
      'rawBiometricTemplate',
      'fingerprintTemplate',
      'faceTemplate',
    ].filter((field) =>
      Boolean((dto as unknown as Record<string, unknown>)[field]),
    );

    if (deniedFields.length > 0) {
      throw new BadRequestException(
        'Raw biometric templates are not allowed. Store only a hash or an opaque storage reference.',
      );
    }

    if (
      dto.biometricProcessingLocation === 'vendor' &&
      !dto.biometricVendor?.trim()
    ) {
      throw new BadRequestException(
        'A biometric vendor must be supplied when processing is delegated to a vendor.',
      );
    }
  }

  /**
   * Records a workspace check-in for the given user.
   * Validates the workspace is active and ensures no duplicate active check-in exists.
   * @param dto - Check-in data including workspaceId, optional bookingId and notes
   * @param userId - UUID of the user checking in
   * @returns The newly created WorkspaceLog entry
   * @throws NotFoundException if the workspace does not exist or is inactive
   * @throws BadRequestException if the user already has an active check-in for this workspace
   */
  async checkIn(dto: CheckInDto, userId: string): Promise<WorkspaceLog> {
    this.validateBiometricPrivacy(dto);
    const workspace = await this.workspacesRepository.findOne({
      where: { id: dto.workspaceId, isActive: true },
    });
    if (!workspace) {
      throw new NotFoundException(`Workspace "${dto.workspaceId}" not found`);
    }

    // Prevent duplicate active check-in for same user + workspace
    const activeLog = await this.logsRepository.findOne({
      where: { userId, workspaceId: dto.workspaceId, checkedOutAt: IsNull() },
    });
    if (activeLog) {
      throw new BadRequestException(
        'You already have an active check-in for this workspace',
      );
    }

    const log = this.logsRepository.create({
      userId,
      workspaceId: dto.workspaceId,
      bookingId: dto.bookingId ?? null,
      notes: dto.notes ?? null,
      biometricTemplateHash: dto.biometricTemplateHash ?? null,
      biometricStorageReference: dto.biometricStorageReference ?? null,
      biometricProcessingLocation: dto.biometricProcessingLocation ?? null,
      biometricVendor: dto.biometricVendor ?? null,
    });

    return this.logsRepository.save(log);
  }

  /**
   * Records a checkout for an existing active workspace log entry.
   * Calculates and stores the session duration in minutes.
   * @param logId - UUID of the active workspace log to close
   * @param userId - UUID of the user checking out (must match the log owner)
   * @returns The updated WorkspaceLog entry with checkout time and duration
   * @throws NotFoundException if no active log is found for the given id and user
   */
  async checkOut(logId: string, userId: string): Promise<WorkspaceLog> {
    const log = await this.logsRepository.findOne({
      where: { id: logId, userId, checkedOutAt: IsNull() },
    });
    if (!log) {
      throw new NotFoundException(
        'Active check-in not found or already checked out',
      );
    }

    const now = new Date();
    log.checkedOutAt = now;
    log.durationMinutes = Math.round(
      (now.getTime() - log.checkedInAt.getTime()) / 60000,
    );

    return this.logsRepository.save(log);
  }

  /**
   * Retrieves the current active (not yet checked-out) log for a user.
   * @param userId - UUID of the user to query
   * @param workspaceId - Optional workspace UUID to narrow the search
   * @returns The active WorkspaceLog, or null if no active check-in exists
   */
  async getActiveCheckIn(
    userId: string,
    workspaceId?: string,
  ): Promise<WorkspaceLog | null> {
    const where: Record<string, unknown> = { userId, checkedOutAt: IsNull() };
    if (workspaceId) where.workspaceId = workspaceId;

    return this.logsRepository.findOne({ where: where as any });
  }

  async getStorageAuditSummary(): Promise<BiometricStorageAuditSummary> {
    const [totalLogs, logsWithHashedTemplates, logsWithOpaqueStorageRefs] =
      await Promise.all([
        this.logsRepository.count(),
        this.logsRepository.count({
          where: { biometricTemplateHash: Not(IsNull()) },
        }),
        this.logsRepository.count({
          where: { biometricStorageReference: Not(IsNull()) },
        }),
      ]);

    return {
      totalLogs,
      logsWithHashedTemplates,
      logsWithOpaqueStorageRefs,
      rawBiometricRows: 0,
      storagePolicy: 'hash-only-or-opaque-reference',
      recommendedProcessing: 'local-processing-preferred',
    };
  }
}
