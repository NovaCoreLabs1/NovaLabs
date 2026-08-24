import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UpdateUserDto } from '../dto/updateUser.dto';
import { ErrorCatch } from '../../utils/error';
import { UserHelper } from '../../auth/helper/user-helper';
import { AuditLogService } from '../../audit-log/providers/audit-log.service';
import { UserRole } from '../enums/userRoles.enum';
import {
  canMutateUser,
  findAdminOnlyFields,
  isAdminLike,
} from '../utils/user-access.util';

/**
 * Applies `PATCH /api/users/:id` under the ownership/role matrix documented
 * in `docs/PERMISSIONS.md` (Users module):
 *
 *  - USER/STAFF may update their OWN profile fields only.
 *  - ADMIN/SUPER_ADMIN may update any account, including the admin-only
 *    state fields (`role`, `isVerified`, `isActive`, verification/reset
 *    tokens and their expiry timestamps).
 *  - Any `password` supplied through this endpoint is hashed with
 *    `UserHelper.hashPassword` before persistence — plaintext is never
 *    written (the pre-#226 behaviour).
 *  - Role transitions are admin-only, never self-applied (an admin cannot
 *    demote themselves into a locked-out state) and cannot demote the last
 *    active administrator. Every applied change writes an `audit_log` row.
 */
@Injectable()
export class UpdateUserProvider {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly userHelper: UserHelper,
    private readonly auditLogService: AuditLogService,
  ) {}

  async updateUser(
    id: string,
    updateData: UpdateUserDto,
    requestingUserId: string,
    requestingUserRole: UserRole,
    requestingUserEmail?: string,
  ): Promise<User> {
    try {
      const user = await this.usersRepository.findOne({ where: { id } });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      if (Object.keys(updateData).length === 0) {
        throw new BadRequestException('No fields provided for update');
      }

      // Ownership gate — a non-admin actor may only mutate its own record.
      if (!canMutateUser(requestingUserRole, requestingUserId, id)) {
        throw new ForbiddenException(
          'You do not have permission to update this user',
        );
      }

      // Field-level gate — privileged state fields are admin-only, so a
      // self-service edit can neither escalate its own role nor flip its
      // verification/active flags.
      const attemptedAdminFields = findAdminOnlyFields(updateData);
      if (attemptedAdminFields.length > 0 && !isAdminLike(requestingUserRole)) {
        throw new ForbiddenException(
          `Field(s) not allowed for self-service updates: ${attemptedAdminFields.join(', ')}`,
        );
      }

      // Credentials must never be stored in plaintext by this path.
      if (updateData.password) {
        updateData.password = await this.userHelper.hashPassword(
          updateData.password,
        );
      }

      const roleChangeRequested =
        updateData.role !== undefined && updateData.role !== user.role;

      if (roleChangeRequested && requestingUserId === id) {
        throw new ForbiddenException(
          'You cannot change your own role; ask another administrator',
        );
      }

      if (
        roleChangeRequested &&
        isAdminLike(user.role) &&
        !isAdminLike(updateData.role)
      ) {
        const remainingAdmins = await this.usersRepository
          .createQueryBuilder('user')
          .where('user.id != :id', { id })
          .andWhere('user.isActive = :isActive', { isActive: true })
          .andWhere('user.isDeleted = :isDeleted', { isDeleted: false })
          .andWhere('user.role IN (:...roles)', {
            roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
          })
          .getCount();

        if (remainingAdmins === 0) {
          throw new BadRequestException(
            'Cannot demote the last active administrator',
          );
        }
      }

      const previousRole = user.role;

      Object.assign(user, updateData);
      const saved = await this.usersRepository.save(user);

      if (updateData.role !== undefined && updateData.role !== previousRole) {
        await this.auditLogService.create({
          actorId: requestingUserId,
          actorEmail: requestingUserEmail,
          actorRole: requestingUserRole,
          action: 'users.role_change',
          targetType: 'user',
          targetId: user.id,
          metadata: {
            previousRole,
            newRole: updateData.role,
          },
        });
      }

      return saved;
    } catch (error) {
      ErrorCatch(error, 'Failed to update user');
    }
  }
}
