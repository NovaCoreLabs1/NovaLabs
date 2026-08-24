import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UpdateUserProvider } from './updateUser.provider';
import { User } from '../entities/user.entity';
import { UserHelper } from '../../auth/helper/user-helper';
import { AuditLogService } from '../../audit-log/providers/audit-log.service';
import { UserRole } from '../enums/userRoles.enum';

describe('UpdateUserProvider (issue #226 authorization)', () => {
  let provider: UpdateUserProvider;
  let auditLogService: { create: jest.Mock };

  const targetUserId = '00000000-0000-0000-0000-000000000002';
  const otherUserId = '00000000-0000-0000-0000-000000000003';
  const adminId = '00000000-0000-0000-0000-000000000001';

  const buildUser = (overrides: Partial<User> = {}): User =>
    ({
      id: targetUserId,
      email: 'target@example.com',
      firstname: 'Target',
      lastname: 'User',
      role: UserRole.USER,
      isActive: true,
      isDeleted: false,
      isVerified: false,
      password: 'existing-hashed-password',
      ...overrides,
    }) as User;

  const adminCountQuery = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(1),
  };

  const usersRepository = {
    findOne: jest.fn(),
    save: jest.fn(async (user: User) => user),
    createQueryBuilder: jest.fn(() => adminCountQuery),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    auditLogService = { create: jest.fn().mockResolvedValue(undefined) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateUserProvider,
        UserHelper,
        { provide: getRepositoryToken(User), useValue: usersRepository },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    provider = moduleRef.get(UpdateUserProvider);
  });

  describe('cross-user writes', () => {
    it('rejects a USER patching another user with ForbiddenException', async () => {
      usersRepository.findOne.mockResolvedValue(buildUser());

      await expect(
        provider.updateUser(
          targetUserId,
          { firstname: 'Hacked' },
          otherUserId,
          UserRole.USER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects STAFF patching another user', async () => {
      usersRepository.findOne.mockResolvedValue(buildUser());

      await expect(
        provider.updateUser(
          targetUserId,
          { firstname: 'Nope' },
          otherUserId,
          UserRole.STAFF,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('role escalation attempts', () => {
    it('rejects a USER setting their own role', async () => {
      usersRepository.findOne.mockResolvedValue(buildUser());

      await expect(
        provider.updateUser(
          targetUserId,
          { role: UserRole.ADMIN },
          targetUserId,
          UserRole.USER,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(usersRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a USER flipping their own isVerified / isActive flags', async () => {
      usersRepository.findOne.mockResolvedValue(buildUser());

      await expect(
        provider.updateUser(
          targetUserId,
          { isVerified: true },
          targetUserId,
          UserRole.USER,
        ),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        provider.updateUser(
          targetUserId,
          { isActive: true },
          targetUserId,
          UserRole.USER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a USER planting verification tokens via self-edit', async () => {
      usersRepository.findOne.mockResolvedValue(buildUser());

      await expect(
        provider.updateUser(
          targetUserId,
          { verificationToken: 'self-minted-token' },
          targetUserId,
          UserRole.USER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('persists nothing when the escalation attempt fails', async () => {
      usersRepository.findOne.mockResolvedValue(
        buildUser({ role: UserRole.USER }),
      );

      await expect(
        provider.updateUser(
          targetUserId,
          { role: UserRole.SUPER_ADMIN },
          targetUserId,
          UserRole.STAFF,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(usersRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('password handling', () => {
    it('hashes an accepted password before persistence', async () => {
      const plaintext = 'Sup3rSecret!';
      usersRepository.findOne.mockResolvedValue(buildUser());

      await provider.updateUser(
        targetUserId,
        { password: plaintext },
        targetUserId,
        UserRole.USER,
      );

      const persisted = usersRepository.save.mock.calls[0][0] as User;
      expect(persisted.password).not.toEqual(plaintext);
      expect(bcrypt.compareSync(plaintext, persisted.password)).toBe(true);
    });
  });

  describe('legitimate self-service edits', () => {
    it('lets a USER update their own profile fields', async () => {
      usersRepository.findOne.mockResolvedValue(buildUser());

      const result = await provider.updateUser(
        targetUserId,
        { firstname: 'Renamed' },
        targetUserId,
        UserRole.USER,
      );

      expect(result.firstname).toEqual('Renamed');
      expect(usersRepository.save).toHaveBeenCalledTimes(1);
      expect(auditLogService.create).not.toHaveBeenCalled();
    });
  });

  describe('admin flows', () => {
    it('lets an ADMIN update another user including state fields', async () => {
      usersRepository.findOne.mockResolvedValue(
        buildUser({ isVerified: false }),
      );

      const result = await provider.updateUser(
        targetUserId,
        { isVerified: true },
        adminId,
        UserRole.ADMIN,
        'admin@example.com',
      );

      expect(result.isVerified).toBe(true);
    });

    it('applies an admin-initiated role change and writes an audit entry', async () => {
      usersRepository.findOne.mockResolvedValue(
        buildUser({ role: UserRole.USER }),
      );

      await provider.updateUser(
        targetUserId,
        { role: UserRole.ADMIN },
        adminId,
        UserRole.ADMIN,
        'admin@example.com',
      );

      const persisted = usersRepository.save.mock.calls[0][0] as User;
      expect(persisted.role).toEqual(UserRole.ADMIN);

      expect(auditLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: adminId,
          actorEmail: 'admin@example.com',
          actorRole: UserRole.ADMIN,
          action: 'users.role_change',
          targetType: 'user',
          targetId: targetUserId,
          metadata: { previousRole: UserRole.USER, newRole: UserRole.ADMIN },
        }),
      );
    });

    it('does not write a role-change audit entry when the role value is unchanged', async () => {
      usersRepository.findOne.mockResolvedValue(
        buildUser({ role: UserRole.USER }),
      );

      await provider.updateUser(
        targetUserId,
        { role: UserRole.USER },
        adminId,
        UserRole.ADMIN,
      );

      expect(auditLogService.create).not.toHaveBeenCalled();
    });

    it('blocks an admin changing their own role (lock-out prevention)', async () => {
      usersRepository.findOne.mockResolvedValue(
        buildUser({ id: adminId, role: UserRole.ADMIN }),
      );

      await expect(
        provider.updateUser(
          adminId,
          { role: UserRole.USER },
          adminId,
          UserRole.ADMIN,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks demoting the last active administrator', async () => {
      usersRepository.findOne.mockResolvedValue(
        buildUser({ role: UserRole.ADMIN }),
      );
      adminCountQuery.getCount.mockResolvedValueOnce(0);

      await expect(
        provider.updateUser(
          targetUserId,
          { role: UserRole.USER },
          adminId,
          UserRole.ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(usersRepository.save).not.toHaveBeenCalled();
    });

    it('allows demotion when another active administrator remains', async () => {
      usersRepository.findOne.mockResolvedValue(
        buildUser({ id: targetUserId, role: UserRole.ADMIN }),
      );
      adminCountQuery.getCount.mockResolvedValueOnce(2);

      const result = await provider.updateUser(
        targetUserId,
        { role: UserRole.USER },
        adminId,
        UserRole.ADMIN,
      );

      expect(result.role).toEqual(UserRole.USER);
    });
  });

  describe('input validation preserved', () => {
    it('404s when the target does not exist', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        provider.updateUser(
          targetUserId,
          { firstname: 'X' },
          adminId,
          UserRole.ADMIN,
        ),
      ).rejects.toMatchObject({
        status: 404,
      });
    });

    it('400s on an empty payload', async () => {
      usersRepository.findOne.mockResolvedValue(buildUser());

      await expect(
        provider.updateUser(targetUserId, {}, targetUserId, UserRole.USER),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
