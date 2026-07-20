import { Test, TestingModule } from '@nestjs/testing';
import { FindAllAdminsProvider } from './findAllAdmins.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { UserRole } from '../enums/userRoles.enum';

describe('FindAllAdminsProvider', () => {
  let provider: FindAllAdminsProvider;
  let usersRepository: any;

  const mockAdmins = [
    { id: 'admin-1', email: 'admin1@example.com', role: UserRole.ADMIN },
    { id: 'admin-2', email: 'admin2@example.com', role: UserRole.ADMIN },
  ];

  beforeEach(async () => {
    usersRepository = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FindAllAdminsProvider,
        { provide: getRepositoryToken(User), useValue: usersRepository },
      ],
    }).compile();

    provider = module.get<FindAllAdminsProvider>(FindAllAdminsProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getAdmins', () => {
    it('returns all admin users', async () => {
      usersRepository.find.mockResolvedValue(mockAdmins);

      const result = await provider.getAdmins();

      expect(result).toEqual(mockAdmins);
      expect(usersRepository.find).toHaveBeenCalledWith({
        where: { role: UserRole.ADMIN },
      });
    });

    it('returns empty array when no admins exist', async () => {
      usersRepository.find.mockResolvedValue([]);

      const result = await provider.getAdmins();

      expect(result).toEqual([]);
    });

    it('throws InternalServerErrorException when repository fails', async () => {
      usersRepository.find.mockRejectedValue(new Error('DB error'));

      await expect(provider.getAdmins()).rejects.toThrow(
        'Error fetching admins: Internal server error',
      );
    });
  });
});
