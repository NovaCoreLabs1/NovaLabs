import { Test, TestingModule } from '@nestjs/testing';
import { FindOneUserByIdProvider } from './findOneUserById.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { UnauthorizedException } from '@nestjs/common';

describe('FindOneUserByIdProvider', () => {
  let provider: FindOneUserByIdProvider;
  let usersRepository: any;

  const mockUser = {
    id: 'user-1',
    email: 'alice@example.com',
    firstname: 'Alice',
    lastname: 'Smith',
  };

  beforeEach(async () => {
    usersRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FindOneUserByIdProvider,
        { provide: getRepositoryToken(User), useValue: usersRepository },
      ],
    }).compile();

    provider = module.get<FindOneUserByIdProvider>(FindOneUserByIdProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getUser', () => {
    it('returns user when found', async () => {
      usersRepository.findOne.mockResolvedValue(mockUser);

      const result = await provider.getUser('user-1');

      expect(result).toEqual(mockUser);
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('throws UnauthorizedException when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(provider.getUser('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws InternalServerErrorException when repository fails', async () => {
      usersRepository.findOne.mockRejectedValue(new Error('DB error'));

      await expect(provider.getUser('user-1')).rejects.toThrow(
        'Error retrieving user details: Internal server error',
      );
    });
  });
});
