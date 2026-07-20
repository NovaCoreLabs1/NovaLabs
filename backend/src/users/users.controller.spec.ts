import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './providers/users.service';
import { UserRole } from './enums/userRoles.enum';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: any;

  const mockUser = {
    id: 'user-1',
    firstname: 'Alice',
    lastname: 'Smith',
    email: 'alice@example.com',
    role: UserRole.USER,
    profilePicture: null,
  };

  beforeEach(async () => {
    usersService = {
      uploadUserProfilePicture: jest.fn(),
      resetPassword: jest.fn(),
      findOnePublicById: jest.fn(),
      findAllUsers: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadProfilePicture', () => {
    it('uploads profile picture and returns response', async () => {
      const file = { buffer: Buffer.from('test') } as Express.Multer.File;
      usersService.uploadUserProfilePicture.mockResolvedValue({
        id: 'user-1',
        profilePicture: 'https://cloudinary.com/pic.jpg',
      });

      const result = await controller.uploadProfilePicture(
        'user-1',
        file,
        'user-1',
        UserRole.USER,
      );

      expect(result).toEqual({
        message: 'Profile picture updated successfully',
        data: {
          id: 'user-1',
          profilePicture: 'https://cloudinary.com/pic.jpg',
        },
      });
      expect(usersService.uploadUserProfilePicture).toHaveBeenCalledWith(
        'user-1',
        file,
        'user-1',
        UserRole.USER,
      );
    });
  });

  describe('resetPassword', () => {
    it('resets password and returns result', async () => {
      usersService.resetPassword.mockResolvedValue({
        message: 'Password reset successful',
      });

      const result = await controller.resetPassword({
        token: 'reset-token',
        newPassword: 'NewPass123!',
      });

      expect(usersService.resetPassword).toHaveBeenCalledWith(
        'reset-token',
        'NewPass123!',
      );
    });
  });

  describe('findOne', () => {
    it('returns user by id without password', async () => {
      usersService.findOnePublicById.mockResolvedValue(mockUser);

      const result = await controller.findOne('user-1');

      expect(result).toEqual({
        message: 'User retrieved successfully',
        data: mockUser,
      });
    });
  });

  describe('findAll', () => {
    it('returns all users', async () => {
      usersService.findAllUsers.mockResolvedValue([mockUser]);

      const result = await controller.findAll();

      expect(result).toEqual({ success: true, data: [mockUser] });
    });
  });

  describe('update', () => {
    it('updates user and returns response', async () => {
      usersService.updateUser.mockResolvedValue({
        ...mockUser,
        firstname: 'Alice Updated',
      });

      const result = await controller.update('user-1', {
        firstname: 'Alice Updated',
      } as any);

      expect(result.success).toBe(true);
      expect(result.data.firstname).toBe('Alice Updated');
    });
  });

  describe('remove', () => {
    it('deletes user and returns no content', async () => {
      usersService.deleteUser.mockResolvedValue(undefined);

      const result = await controller.remove('user-1');

      expect(result).toBeUndefined();
    });
  });
});
