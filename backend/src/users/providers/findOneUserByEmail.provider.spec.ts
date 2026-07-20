import { Test, TestingModule } from '@nestjs/testing';
import { FindOneUserByEmailProvider } from './findOneUserByEmail.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { UnauthorizedException } from '@nestjs/common';

describe('FindOneUserByEmailProvider', () => {
  let provider: FindOneUserByEmailProvider;
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
        FindOneUserByEmailProvider,
        { provide: getRepositoryToken(User), useValue: usersRepository },
      ],
    }).compile();

    provider = module.get<FindOneUserByEmailProvider>(
      FindOneUserByEmailProvider,
    );
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getUser', () => {
    it('returns user when found by email', async () => {
      usersRepository.findOne.mockResolvedValue(mockUser);

      const result = await provider.getUser('alice@example.com');

      expect(result).toEqual(mockUser);
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'alice@example.com' },
      });
    });

    it('throws UnauthorizedException when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(provider.getUser('unknown@example.com')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws InternalServerErrorException when repository fails', async () => {
      usersRepository.findOne.mockRejectedValue(new Error('DB error'));

      await expect(provider.getUser('alice@example.com')).rejects.toThrow(
        'Error retrieving user details: Internal server error',
      );
    });
  });
});
