import { Test, TestingModule } from '@nestjs/testing';
import { DeleteUserProvider } from './deleteUser.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { NotFoundException } from '@nestjs/common';

describe('DeleteUserProvider', () => {
  let provider: DeleteUserProvider;
  let usersRepository: any;

  beforeEach(async () => {
    usersRepository = {
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteUserProvider,
        { provide: getRepositoryToken(User), useValue: usersRepository },
      ],
    }).compile();

    provider = module.get<DeleteUserProvider>(DeleteUserProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('deleteUser', () => {
    it('deletes user successfully', async () => {
      usersRepository.delete.mockResolvedValue({ affected: 1 });

      await expect(provider.deleteUser('user-1')).resolves.not.toThrow();
      expect(usersRepository.delete).toHaveBeenCalledWith('user-1');
    });

    it('throws NotFoundException when user not found', async () => {
      usersRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(provider.deleteUser('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws InternalServerErrorException when repository fails', async () => {
      usersRepository.delete.mockRejectedValue(new Error('DB error'));

      await expect(provider.deleteUser('user-1')).rejects.toThrow(
        'Failed to delete user: Internal server error',
      );
    });
  });
});
