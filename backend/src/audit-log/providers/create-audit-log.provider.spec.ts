import { Test, TestingModule } from '@nestjs/testing';
import { CreateAuditLogProvider } from './create-audit-log.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { Repository } from 'typeorm';

describe('CreateAuditLogProvider', () => {
  let provider: CreateAuditLogProvider;
  let repository: any;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateAuditLogProvider,
        { provide: getRepositoryToken(AuditLog), useValue: repository },
      ],
    }).compile();

    provider = module.get<CreateAuditLogProvider>(CreateAuditLogProvider);
  });

  it('creates an audit log with all fields', async () => {
    const input = {
      actorId: 'user-1',
      actorEmail: 'admin@example.com',
      actorRole: 'admin',
      action: 'users.create',
      targetType: 'user',
      targetId: 'target-1',
      ipAddress: '192.168.1.1',
      userAgent: 'Chrome/120',
      metadata: { handler: 'createUser', statusCode: 201 },
    };

    const createdEntity = { id: 'log-1', ...input };
    repository.create.mockReturnValue(createdEntity);
    repository.save.mockResolvedValue(createdEntity);

    const result = await provider.create(input);

    expect(result).toEqual(createdEntity);
    expect(repository.create).toHaveBeenCalledWith({
      actorId: 'user-1',
      actorEmail: 'admin@example.com',
      actorRole: 'admin',
      action: 'users.create',
      targetType: 'user',
      targetId: 'target-1',
      ipAddress: '192.168.1.1',
      userAgent: 'Chrome/120',
      metadata: { handler: 'createUser', statusCode: 201 },
    });
    expect(repository.save).toHaveBeenCalledWith(createdEntity);
  });

  it('sets null for missing optional fields', async () => {
    const input = {
      action: 'auth.login',
    } as any;

    repository.create.mockReturnValue({ id: 'log-2', ...input });
    repository.save.mockResolvedValue({ id: 'log-2', ...input });

    await provider.create(input);

    expect(repository.create).toHaveBeenCalledWith({
      actorId: null,
      actorEmail: null,
      actorRole: null,
      action: 'auth.login',
      targetType: null,
      targetId: null,
      ipAddress: null,
      userAgent: null,
      metadata: null,
    });
  });

  it('re-throws error when save fails', async () => {
    repository.create.mockReturnValue({});
    repository.save.mockRejectedValue(new Error('DB error'));

    await expect(provider.create({ action: 'test' } as any)).rejects.toThrow(
      'DB error',
    );
  });
});
