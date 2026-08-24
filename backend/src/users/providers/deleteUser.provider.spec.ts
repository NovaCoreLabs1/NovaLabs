import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DeleteUserProvider } from './deleteUser.provider';
import { User } from '../entities/user.entity';
import { AuditLogService } from '../../audit-log/providers/audit-log.service';
import { UserRole } from '../enums/userRoles.enum';

describe('DeleteUserProvider (issue #226 authorization)', () => {
  let provider: DeleteUserProvider;
  let auditLogService: { create: jest.Mock };

  const targetUserId = '00000000-0000-0000-0000-000000000002';
  const adminId = '00000000-0000-0000-0000-000000000001';

  const usersRepository = {
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    auditLogService = { create: jest.fn().mockResolvedValue(undefined) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteUserProvider,
        { provide: getRepositoryToken(User), useValue: usersRepository },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    provider = moduleRef.get(DeleteUserProvider);
  });

  it('rejects a non-admin actor with ForbiddenException and deletes nothing', async () => {
    await expect(
      provider.deleteUser(
        targetUserId,
        '00000000-0000-0000-0000-000000000004',
        UserRole.USER,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(usersRepository.delete).not.toHaveBeenCalled();
    expect(auditLogService.create).not.toHaveBeenCalled();
  });

  it('rejects STAFF as well — member management is not account deletion', async () => {
    await expect(
      provider.deleteUser(
        targetUserId,
        '00000000-0000-0000-0000-000000000005',
        UserRole.STAFF,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(usersRepository.delete).not.toHaveBeenCalled();
  });

  it('lets an ADMIN hard-delete an account and writes an audit entry', async () => {
    await provider.deleteUser(
      targetUserId,
      adminId,
      UserRole.ADMIN,
      'admin@example.com',
    );

    expect(usersRepository.delete).toHaveBeenCalledWith(targetUserId);
    expect(auditLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: adminId,
        actorEmail: 'admin@example.com',
        actorRole: UserRole.ADMIN,
        action: 'users.admin_delete',
        targetType: 'user',
        targetId: targetUserId,
      }),
    );
  });

  it('404s when the account does not exist and audits nothing', async () => {
    usersRepository.delete.mockResolvedValueOnce({ affected: 0 });

    await expect(
      provider.deleteUser(targetUserId, adminId, UserRole.SUPER_ADMIN),
    ).rejects.toThrow(NotFoundException);

    expect(auditLogService.create).not.toHaveBeenCalled();
  });
});
