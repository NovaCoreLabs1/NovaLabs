import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AnonymiseUserProvider } from './anonymise-user.provider';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../../auth/entities/refreshToken.entity';
import { WorkspaceLog } from '../../workspace-tracking/entities/workspace-log.entity';
import { AuditLogService } from '../../audit-log/providers/audit-log.service';

describe('AnonymiseUserProvider', () => {
  let provider: AnonymiseUserProvider;

  const mockUser = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'user@example.com',
    firstname: 'Alice',
    lastname: 'Doe',
    phone: '+1234567890',
    profilePicture: 'https://cdn.example.com/p.png',
    password: 'hashed',
    verificationCode: '123456',
    passwordResetCode: null,
    totpSecret: null,
    totpBackupCodes: null,
    passkeyCredentials: null,
    twoFactorEnabled: false,
    isVerified: true,
    isActive: true,
    isSuspended: false,
    isDeleted: false,
    deletedAt: null,
    refreshTokens: [],
    role: 'user',
  } as unknown as User;

  const transactionalManager = {
    create: jest.fn().mockImplementation((_entity, payload) => payload),
    save: jest.fn().mockImplementation(async (entity, payload) => ({
      id: mockUser.id,
      ...payload,
    })),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(mockUser),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    })),
  };

  const mockDataSource = {
    transaction: jest.fn(async (cb) => cb(transactionalManager)),
  };

  const usersRepository = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    manager: {
      count: jest.fn().mockResolvedValue(0),
    },
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    })),
  };

  const refreshTokenRepository = {
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    createQueryBuilder: jest.fn(() => ({
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    })),
  };

  const workspaceLogRepository = {
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    createQueryBuilder: jest.fn(() => ({
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    })),
  };

  const auditLogService = {
    create: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    transactionalManager.create.mockImplementation((_entity, payload) => payload);
    transactionalManager.save.mockImplementation(async (entity, payload) => ({
      id: mockUser.id,
      ...payload,
    }));
    transactionalManager.find.mockResolvedValue([]);
    transactionalManager.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    });

    usersRepository.findOne.mockResolvedValue(mockUser);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnonymiseUserProvider,
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(User), useValue: usersRepository },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshTokenRepository,
        },
        {
          provide: getRepositoryToken(WorkspaceLog),
          useValue: workspaceLogRepository,
        },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    provider = module.get<AnonymiseUserProvider>(AnonymiseUserProvider);
  });

  it('throws NotFoundException if the user does not exist', async () => {
    usersRepository.findOne.mockResolvedValueOnce(null);
    await expect(provider.anonymise('ghost')).rejects.toThrow(/not found/i);
  });

  it('short-circuits and writes nothing if user is already anonymised', async () => {
    usersRepository.findOne.mockResolvedValueOnce({
      ...mockUser,
      isDeleted: true,
    });
    await provider.anonymise(mockUser.id);
    expect(auditLogService.create).not.toHaveBeenCalled();
    expect(mockDataSource.transaction).not.toHaveBeenCalled();
  });

  it('anonymises the user in a single transaction with no credentials left', async () => {
    await provider.anonymise(mockUser.id, 'leaving for good');

    expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);

    // 1. audit log written inside the transaction
    expect(auditLogService.create).toHaveBeenCalledTimes(1);
    const auditArg = auditLogService.create.mock.calls[0][0];
    expect(auditArg.action).toBe('users.anonymise');
    expect(auditArg.targetId).toBe(mockUser.id);
    expect(auditArg.metadata.mode).toBe('self_service');
    expect(auditArg.metadata.reason).toBe('leaving for good');
    expect(auditArg.metadata.originalEmailHash).toMatch(/^[a-f0-9]{64}$/);

    // 2. refresh tokens hard-deleted in transaction
    expect(transactionalManager.delete).toHaveBeenCalledWith(
      RefreshToken,
      { userId: mockUser.id },
    );

    // 3. workspace logs hard-deleted in transaction
    expect(transactionalManager.delete).toHaveBeenCalledWith(
      WorkspaceLog,
      { userId: mockUser.id },
    );

    // 4. booking/payment userId set to NULL via update builder
    expect(transactionalManager.createQueryBuilder).toHaveBeenCalled();

    // 5. user row replaced with anonymised payload
    const saveCalls = transactionalManager.save.mock.calls;
    const userSave = saveCalls.find(([, payload]) => payload?.id === mockUser.id);
    expect(userSave).toBeDefined();
    const anonymisedRow = userSave[1];

    expect(anonymisedRow.password).toBeNull();
    expect(anonymisedRow.totpSecret).toBeNull();
    expect(anonymisedRow.verificationCode).toBeNull();
    expect(anonymisedRow.twoFactorEnabled).toBe(false);
    expect(anonymisedRow.isActive).toBe(false);
    expect(anonymisedRow.isDeleted).toBe(true);
    expect(anonymisedRow.deletedAt).toBeInstanceOf(Date);

    // The firstname MUST be a placeholder, never the original
    expect(anonymisedRow.firstname).toMatch(/^deleted-user-/);
    expect(anonymisedRow.firstname).not.toBe('Alice');

    // The email MUST be hashed and the special marker domain
    expect(anonymisedRow.email).toMatch(
      /^[a-f0-9]{64}@deleted\.novalabs\.internal$/,
    );
    expect(anonymisedRow.email).not.toBe('user@example.com');
  });

  it('re-throws errors from inside the transaction without partial state', async () => {
    mockDataSource.transaction.mockImplementationOnce(async () => {
      throw new Error('db exploded');
    });
    await expect(provider.anonymise(mockUser.id)).rejects.toThrow(/db exploded/);
  });

  it('hardenDeletedUsers reports refresh-token / workspace-log cleanup counts', async () => {
    usersRepository.find.mockResolvedValueOnce([mockUser, { id: 'uid-2' } as User]);
    refreshTokenRepository.createQueryBuilder.mockReturnValueOnce({
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValueOnce({ affected: 4 }),
    });
    workspaceLogRepository.createQueryBuilder.mockReturnValueOnce({
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValueOnce({ affected: 7 }),
    });

    const result = await provider.hardenDeletedUsers();

    expect(result).toEqual({ refreshTokens: 4, workspaceLogs: 7 });
    expect(usersRepository.find).toHaveBeenCalledWith({
      where: { isDeleted: true },
      select: ['id'],
    });
  });
});
