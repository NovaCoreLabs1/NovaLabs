import { Test, TestingModule } from '@nestjs/testing';
import { UpdateUserProvider } from './updateUser.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('UpdateUserProvider', () => {
  let provider: UpdateUserProvider;
  let usersRepository: any;

  const existingUser = {
    id: 'user-1',
    firstname: 'Alice',
    lastname: 'Smith',
    email: 'alice@example.com',
  };

  beforeEach(async () => {
    usersRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateUserProvider,
        { provide: getRepositoryToken(User), useValue: usersRepository },
      ],
    }).compile();

    provider = module.get<UpdateUserProvider>(UpdateUserProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('updateUser', () => {
    it('updates user fields successfully', async () => {
      usersRepository.findOne.mockResolvedValue(existingUser);
      usersRepository.save.mockResolvedValue({
        ...existingUser,
        firstname: 'Alice Updated',
      });

      const result = await provider.updateUser('user-1', {
        firstname: 'Alice Updated',
      });

      expect(result.firstname).toBe('Alice Updated');
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(usersRepository.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        provider.updateUser('nonexistent', { firstname: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when no fields provided', async () => {
      usersRepository.findOne.mockResolvedValue(existingUser);

      await expect(
        provider.updateUser('user-1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws InternalServerErrorException when repository fails', async () => {
      usersRepository.findOne.mockResolvedValue(existingUser);
      usersRepository.save.mockRejectedValue(new Error('DB error'));

      await expect(
        provider.updateUser('user-1', { firstname: 'Test' }),
      ).rejects.toThrow('Failed to update user: Internal server error');
    });
  });
});
