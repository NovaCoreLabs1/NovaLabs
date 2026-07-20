import { Test, TestingModule } from '@nestjs/testing';
import { FindAdminByIdProvider } from './findAdminById.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { NotFoundException } from '@nestjs/common';
import { UserRole } from '../enums/userRoles.enum';

describe('FindAdminByIdProvider', () => {
  let provider: FindAdminByIdProvider;
  let usersRepository: any;

  const mockAdmin = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    firstname: 'Admin',
  };

  beforeEach(async () => {
    usersRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FindAdminByIdProvider,
        { provide: getRepositoryToken(User), useValue: usersRepository },
      ],
    }).compile();

    provider = module.get<FindAdminByIdProvider>(FindAdminByIdProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getAdmin', () => {
    it('returns admin when found with ADMIN role', async () => {
      usersRepository.findOne.mockResolvedValue(mockAdmin);

      const result = await provider.getAdmin('admin-1');

      expect(result).toEqual(mockAdmin);
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'admin-1', role: UserRole.ADMIN },
      });
    });

    it('throws NotFoundException when admin not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(provider.getAdmin('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws InternalServerErrorException when repository fails', async () => {
      usersRepository.findOne.mockRejectedValue(new Error('DB error'));

      await expect(provider.getAdmin('admin-1')).rejects.toThrow(
        'Error retrieving admin details: Internal server error',
      );
    });
  });
});
