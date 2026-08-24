import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { ErrorCatch } from '../../utils/error';
import { AuditLogService } from '../../audit-log/providers/audit-log.service';
import { UserRole } from '../enums/userRoles.enum';
import { isAdminLike } from '../utils/user-access.util';

/**
 * Hard-deletes a user account on behalf of an administrator.
 *
 * `DELETE /api/users/:id` is admin-only (see the matrix in
 * `docs/PERMISSIONS.md` → Users module); self-service account removal goes
 * through `DELETE /api/users/me` (GDPR anonymisation) instead. The role is
 * re-checked here — in addition to the route guard — so no future caller can
 * bypass it by invoking the provider directly, and every delete writes an
 * `audit_log` row identifying actor and target.
 */
@Injectable()
export class DeleteUserProvider {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async deleteUser(
    id: string,
    requestingUserId: string,
    requestingUserRole: UserRole,
    requestingUserEmail?: string,
  ): Promise<void> {
    try {
      if (!isAdminLike(requestingUserRole)) {
        throw new ForbiddenException(
          'Only administrators can delete user accounts',
        );
      }

      const result = await this.usersRepository.delete(id);
      if (result.affected === 0) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      await this.auditLogService.create({
        actorId: requestingUserId,
        actorEmail: requestingUserEmail,
        actorRole: requestingUserRole,
        action: 'users.admin_delete',
        targetType: 'user',
        targetId: id,
      });
    } catch (error) {
      ErrorCatch(error, 'Failed to delete user');
    }
  }
}
