import { Injectable } from '@nestjs/common';
import { CreateAuditLogProvider } from './create-audit-log.provider';
import { FindAuditLogsProvider } from './find-audit-logs.provider';
import { CreateAuditLogInput } from './create-audit-log.provider';
import { AuditLogFilterDto } from '../dto/audit-log-filter.dto';
import { PaginatedAuditLogs } from './find-audit-logs.provider';
import { UserRole } from '../../users/enums/userRoles.enum';

@Injectable()
export class AuditLogService {
  constructor(
    private readonly createAuditLogProvider: CreateAuditLogProvider,
    private readonly findAuditLogsProvider: FindAuditLogsProvider,
  ) {}

  async create(input: CreateAuditLogInput): Promise<void> {
    await this.createAuditLogProvider.create(input);
  }

  async findAll(
    filter: AuditLogFilterDto,
    requestingUserId: string,
    requestingUserRole: UserRole,
  ): Promise<PaginatedAuditLogs> {
    return this.findAuditLogsProvider.findAll(
      filter,
      requestingUserId,
      requestingUserRole,
    );
  }
}
