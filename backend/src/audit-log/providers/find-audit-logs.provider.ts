import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditLogFilterDto } from '../dto/audit-log-filter.dto';
import { UserRole } from '../../users/enums/userRoles.enum';

export interface PaginatedAuditLogs {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class FindAuditLogsProvider {
  private readonly logger = new Logger(FindAuditLogsProvider.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async findAll(
    filter: AuditLogFilterDto,
    requestingUserId: string,
    requestingUserRole: UserRole,
  ): Promise<PaginatedAuditLogs> {
    const {
      actorId,
      action,
      targetType,
      targetId,
      dateFrom,
      dateTo,
      search,
      page = 1,
      limit = 20,
    } = filter;

    const isAdmin =
      requestingUserRole === UserRole.ADMIN ||
      requestingUserRole === UserRole.SUPER_ADMIN;

    let resolvedActorId = actorId;
    if (!isAdmin) {
      resolvedActorId = requestingUserId;
    }

    const qb = this.auditLogRepository
      .createQueryBuilder('auditLog')
      .orderBy('auditLog.createdAt', 'DESC');

    if (resolvedActorId) {
      qb.andWhere('auditLog.actorId = :actorId', { actorId: resolvedActorId });
    }

    if (action) {
      qb.andWhere('auditLog.action = :action', { action });
    }

    if (targetType) {
      qb.andWhere('auditLog.targetType = :targetType', { targetType });
    }

    if (targetId) {
      qb.andWhere('auditLog.targetId = :targetId', { targetId });
    }

    if (dateFrom) {
      qb.andWhere('auditLog.createdAt >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      qb.andWhere('auditLog.createdAt <= :dateTo', { dateTo });
    }

    if (search) {
      qb.andWhere(
        '(auditLog.actorEmail ILIKE :search OR auditLog.targetType ILIKE :search OR auditLog.action ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();

    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
