import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from 'src/users/enums/userRoles.enum';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { AuditLogService } from './providers/audit-log.service';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { AuditLogFilterDto } from './dto/audit-log-filter.dto';
import { GetCurrentUser } from 'src/auth/decorators/getCurrentUser.decorator';

@ApiTags('AuditLog')
@ApiBearerAuth()
@Controller('admin/audit')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List audit logs with filtering (admin only)' })
  @ApiQuery({ name: 'actorId', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'targetType', required: false, type: String })
  @ApiQuery({ name: 'targetId', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query() filter: AuditLogFilterDto,
    @GetCurrentUser('id') userId: string,
    @GetCurrentUser('role') userRole: UserRole,
  ) {
    const result = await this.auditLogService.findAll(filter, userId, userRole);

    return {
      message: 'Audit logs retrieved successfully',
      data: result.data,
      meta: {
        currentPage: result.page,
        itemsPerPage: result.limit,
        totalItems: result.total,
        totalPages: result.totalPages,
        hasPreviousPage: result.page > 1,
        hasNextPage: result.page < result.totalPages,
      },
      totalAmount: String(result.total),
    };
  }
}
