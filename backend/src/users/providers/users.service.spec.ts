import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { CreateUserProvider } from './createUser.provider';
import { FindOneUserByIdProvider } from './findOneUserById.provider';
import { FindOneUserByEmailProvider } from './findOneUserByEmail.provider';
import { ValidateUserProvider } from './validateUser.provider';
import { FindAllUsersProvider } from './findAllUsers.provider';
import { UpdateUserProvider } from './updateUser.provider';
import { DeleteUserProvider } from './deleteUser.provider';
import { UploadProfilePictureProvider } from './uploadProfilePicture.provider';
import { ForgotPasswordProvider } from './forgotPassword.provider';
import { ResetPasswordProvider } from './resetPassword.provider';
import { FindAllAdminsProvider } from './findAllAdmins.provider';
import { FindAdminByIdProvider } from './findAdminById.provider';
import { GetMembersProvider } from './get-members.provider';
import { UpdateMemberStatusProvider } from './update-member-status.provider';
import { GetMemberStatsProvider } from './get-member-stats.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { NotFoundException } from '@nestjs/common';
import { UserRole } from '../enums/userRoles.enum';
import { MembershipStatus } from '../enums/membership-status.enum';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: any;

  // Providers
  let createUserProvider: any;
  let findOneUserByIdProvider: any;
  let findOneUserByEmailProvider: any;
  let validateUserProvider: any;
  let findAllUsersProvider: any;
  let updateUserProvider: any;
  let deleteUserProvider: any;
  let uploadProfilePictureProvider: any;
  let forgotPasswordProvider: any;
  let resetPasswordProvider: any;
  let findAllAdminsProvider: any;
  let findAdminByIdProvider: any;
  let getMembersProvider: any;
  let updateMemberStatusProvider: any;
  let getMemberStatsProvider: any;

  const mockUser = {
    id: 'user-1',
    firstname: 'Alice',
    lastname: 'Smith',
    email: 'alice@example.com',
    password: 'hashed-password',
    role: UserRole.USER,
    isVerified: true,
    profileCompleteness: 50,
    membershipStatus: MembershipStatus.ACTIVE,
  };

  beforeEach(async () => {
    // Create mocks for all providers
    createUserProvider = { createUser: jest.fn() };
    findOneUserByIdProvider = { getUser: jest.fn() };
    findOneUserByEmailProvider = { getUser: jest.fn() };
    validateUserProvider = { validateUser: jest.fn() };
    findAllUsersProvider = { getUsers: jest.fn() };
    updateUserProvider = { updateUser: jest.fn() };
    deleteUserProvider = { deleteUser: jest.fn() };
    uploadProfilePictureProvider = { uploadProfilePicture: jest.fn() };
    forgotPasswordProvider = { execute: jest.fn() };
    resetPasswordProvider = { execute: jest.fn() };
    findAllAdminsProvider = { getAdmins: jest.fn() };
    findAdminByIdProvider = { getAdmin: jest.fn() };
    getMembersProvider = { getMembers: jest.fn() };
    updateMemberStatusProvider = { updateStatus: jest.fn() };
    getMemberStatsProvider = { getStats: jest.fn() };

    usersRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: CreateUserProvider, useValue: createUserProvider },
        {
          provide: FindOneUserByIdProvider,
          useValue: findOneUserByIdProvider,
        },
        {
          provide: FindOneUserByEmailProvider,
          useValue: findOneUserByEmailProvider,
        },
        { provide: ValidateUserProvider, useValue: validateUserProvider },
        { provide: FindAllUsersProvider, useValue: findAllUsersProvider },
        { provide: UpdateUserProvider, useValue: updateUserProvider },
        { provide: DeleteUserProvider, useValue: deleteUserProvider },
        {
          provide: UploadProfilePictureProvider,
          useValue: uploadProfilePictureProvider,
        },
        { provide: ForgotPasswordProvider, useValue: forgotPasswordProvider },
        { provide: ResetPasswordProvider, useValue: resetPasswordProvider },
        { provide: FindAllAdminsProvider, useValue: findAllAdminsProvider },
        { provide: FindAdminByIdProvider, useValue: findAdminByIdProvider },
        { provide: GetMembersProvider, useValue: getMembersProvider },
        {
          provide: UpdateMemberStatusProvider,
          useValue: updateMemberStatusProvider,
        },
        { provide: GetMemberStatsProvider, useValue: getMemberStatsProvider },
        { provide: getRepositoryToken(User), useValue: usersRepository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('delegates to CreateUserProvider', async () => {
      const dto: any = { email: 'test@example.com', password: 'Password123!' };
      const response: any = {};
      const expected = { user: {}, accessToken: 'token' };

      createUserProvider.createUser.mockResolvedValue(expected);

      const result = await service.createUser(dto, response);

      expect(result).toEqual(expected);
      expect(createUserProvider.createUser).toHaveBeenCalledWith(dto, response);
    });
  });

  describe('findAllUsers', () => {
    it('delegates to FindAllUsersProvider', async () => {
      findAllUsersProvider.getUsers.mockResolvedValue([mockUser]);

      const result = await service.findAllUsers();

      expect(result).toEqual([mockUser]);
    });
  });

  describe('findAllAdmins', () => {
    it('delegates to FindAllAdminsProvider', async () => {
      findAllAdminsProvider.getAdmins.mockResolvedValue([mockUser]);

      const result = await service.findAllAdmins();

      expect(result).toEqual([mockUser]);
    });
  });

  describe('findUserById', () => {
    it('delegates to FindOneUserByIdProvider', async () => {
      findOneUserByIdProvider.getUser.mockResolvedValue(mockUser);

      const result = await service.findUserById('user-1');

      expect(result).toEqual(mockUser);
    });
  });

  describe('findAdminById', () => {
    it('delegates to FindAdminByIdProvider', async () => {
      findAdminByIdProvider.getAdmin.mockResolvedValue(mockUser);

      const result = await service.findAdminById('admin-1');

      expect(result).toEqual(mockUser);
    });
  });

  describe('findUserByEmail', () => {
    it('delegates to FindOneUserByEmailProvider', async () => {
      findOneUserByEmailProvider.getUser.mockResolvedValue(mockUser);

      const result = await service.findUserByEmail('alice@example.com');

      expect(result).toEqual(mockUser);
    });
  });

  describe('findOnePublicById', () => {
    it('returns user without password', async () => {
      findOneUserByIdProvider.getUser.mockResolvedValue(mockUser);

      const result = await service.findOnePublicById('user-1');

      expect(result.id).toBe('user-1');
      expect((result as any).password).toBeUndefined();
    });

    it('throws NotFoundException when user not found', async () => {
      findOneUserByIdProvider.getUser.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(service.findOnePublicById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUser', () => {
    it('delegates to UpdateUserProvider', async () => {
      updateUserProvider.updateUser.mockResolvedValue(mockUser);

      const result = await service.updateUser('user-1', { firstname: 'Bob' });

      expect(result).toEqual(mockUser);
    });
  });

  describe('deleteUser', () => {
    it('delegates to DeleteUserProvider', async () => {
      deleteUserProvider.deleteUser.mockResolvedValue(undefined);

      await expect(service.deleteUser('user-1')).resolves.not.toThrow();
    });
  });

  describe('validateUser', () => {
    it('delegates to ValidateUserProvider', async () => {
      validateUserProvider.validateUser.mockResolvedValue(mockUser);

      const result = await service.validateUser(
        'alice@example.com',
        'password',
      );

      expect(result).toEqual(mockUser);
    });
  });

  describe('uploadUserProfilePicture', () => {
    it('delegates to UploadProfilePictureProvider', async () => {
      const file: any = { buffer: Buffer.from('test') };
      const expected = { id: 'user-1', profilePicture: 'url' };
      uploadProfilePictureProvider.uploadProfilePicture.mockResolvedValue(
        expected,
      );

      const result = await service.uploadUserProfilePicture(
        'user-1',
        file,
        'user-1',
        UserRole.USER,
      );

      expect(result).toEqual(expected);
    });
  });

  describe('forgotPassword', () => {
    it('delegates to ForgotPasswordProvider', async () => {
      forgotPasswordProvider.execute.mockResolvedValue({
        message: 'Reset instructions sent',
      });

      const result = await service.forgotPassword('alice@example.com');

      expect(result).toEqual({ message: 'Reset instructions sent' });
    });
  });

  describe('resetPassword', () => {
    it('delegates to ResetPasswordProvider', async () => {
      resetPasswordProvider.execute.mockResolvedValue({
        message: 'Password reset successful',
      });

      const result = await service.resetPassword('token', 'newPassword123!');

      expect(result).toEqual({ message: 'Password reset successful' });
    });
  });

  describe('getMembers', () => {
    it('delegates to GetMembersProvider', async () => {
      const paginatedResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };
      getMembersProvider.getMembers.mockResolvedValue(paginatedResult);

      const result = await service.getMembers({});

      expect(result).toEqual(paginatedResult);
    });
  });

  describe('updateMemberStatus', () => {
    it('delegates to UpdateMemberStatusProvider', async () => {
      updateMemberStatusProvider.updateStatus.mockResolvedValue(mockUser);

      const result = await service.updateMemberStatus(
        'member-1',
        MembershipStatus.ACTIVE,
      );

      expect(result).toEqual(mockUser);
    });
  });

  describe('getMemberStats', () => {
    it('delegates to GetMemberStatsProvider', async () => {
      const stats = {
        total: 100,
        active: 60,
        inactive: 30,
        suspended: 10,
        verified: 80,
      };
      getMemberStatsProvider.getStats.mockResolvedValue(stats);

      const result = await service.getMemberStats();

      expect(result).toEqual(stats);
    });
  });

  describe('updateTwoFactor', () => {
    it('enables two-factor auth', async () => {
      findOneUserByIdProvider.getUser.mockResolvedValue(mockUser);
      usersRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.updateTwoFactor('user-1', {
        twoFactorEnabled: true,
      });

      expect(result.twoFactorEnabled).toBe(true);
    });

    it('throws NotFoundException when user not found', async () => {
      findOneUserByIdProvider.getUser.mockResolvedValue(null);

      await expect(
        service.updateTwoFactor('nonexistent', { twoFactorEnabled: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByVerificationToken', () => {
    it('finds user by verification token', async () => {
      usersRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByVerificationToken('some-token');

      expect(result).toEqual(mockUser);
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { verificationToken: 'some-token' },
      });
    });
  });

  describe('findByPasswordResetToken', () => {
    it('finds user by password reset token', async () => {
      usersRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByPasswordResetToken('some-token');

      expect(result).toEqual(mockUser);
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { passwordResetToken: 'some-token' },
      });
    });
  });

  describe('updateProfilePicture', () => {
    it('updates profile picture url and returns old picture', async () => {
      const userWithPic = {
        ...mockUser,
        profilePicture: 'https://old-pic.com/old.jpg',
      };
      findOneUserByIdProvider.getUser.mockResolvedValue(userWithPic);
      usersRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.updateProfilePicture(
        'user-1',
        'https://new-pic.com/new.jpg',
      );

      expect(result.profilePicture).toBe('https://new-pic.com/new.jpg');
      expect(result.oldProfilePicture).toBe('https://old-pic.com/old.jpg');
    });
  });

  describe('getMemberProfile', () => {
    it('returns user profile and updates completeness if needed', async () => {
      findOneUserByIdProvider.getUser.mockResolvedValue({
        ...mockUser,
        profileCompleteness: 0,
      });
      usersRepository.update.mockResolvedValue(undefined);

      const result = await service.getMemberProfile('user-1');

      expect(result).toBeDefined();
      expect(usersRepository.update).toHaveBeenCalledWith('user-1', {
        profileCompleteness: expect.any(Number),
      });
    });

    it('does not update completeness if already correct', async () => {
      findOneUserByIdProvider.getUser.mockResolvedValue(mockUser);

      const result = await service.getMemberProfile('user-1');

      expect(result).toBeDefined();
      expect(usersRepository.update).not.toHaveBeenCalled();
    });
  });
});
