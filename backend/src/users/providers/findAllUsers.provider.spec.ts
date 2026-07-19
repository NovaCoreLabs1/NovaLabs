import { Test, TestingModule } from '@nestjs/testing';
import { FindAllUsersProvider } from './findAllUsers.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';

describe('FindAllUsersProvider', () => {
  let provider: FindAllUsersProvider;
  let usersRepository: any;

  const mockUsers = [
    { id: 'user-1', email: 'alice@example.com', firstname: 'Alice' },
    { id: 'user-2', email: 'bob@example.com', firstname: 'Bob' },
  ];

  beforeEach(async () => {
    usersRepository = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FindAllUsersProvider,
        { provide: getRepositoryToken(User), useValue: usersRepository },
      ],
    }).compile();

    provider = module.get<FindAllUsersProvider>(FindAllUsersProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getUsers', () => {
    it('returns all users', async () => {
      usersRepository.find.mockResolvedValue(mockUsers);

      const result = await provider.getUsers();

      expect(result).toEqual(mockUsers);
      expect(usersRepository.find).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no users exist', async () => {
      usersRepository.find.mockResolvedValue([]);

      const result = await provider.getUsers();

      expect(result).toEqual([]);
    });

    it('throws InternalServerErrorException when repository fails', async () => {
      usersRepository.find.mockRejectedValue(new Error('DB error'));

      await expect(provider.getUsers()).rejects.toThrow(
        'Error fetching users: Internal server error',
      );
    });
  });
});
