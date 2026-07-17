import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './providers/audit-log.service';
import { CreateAuditLogProvider } from './providers/create-audit-log.provider';
import { FindAuditLogsProvider } from './providers/find-audit-logs.provider';
import { AuditLog } from './entities/audit-log.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRole } from '../users/enums/userRoles.enum';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let createProvider: CreateAuditLogProvider;
  let findProvider: FindAuditLogsProvider;

  const mockAuditLogRepository = {
    create: jest.fn((entity) => entity),
    save: jest.fn(async (entity) => entity),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateAuditLogProvider,
        FindAuditLogsProvider,
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepository,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    createProvider = module.get<CreateAuditLogProvider>(CreateAuditLogProvider);
    findProvider = module.get<FindAuditLogsProvider>(FindAuditLogsProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create should call repository create and save', async () => {
    const input = {
      action: 'users.create',
      actorId: '123',
      actorEmail: 'test@example.com',
      actorRole: 'admin',
      targetType: 'user',
      targetId: '456',
    };

    await service.create(input);
    expect(mockAuditLogRepository.create).toHaveBeenCalled();
    expect(mockAuditLogRepository.save).toHaveBeenCalled();
  });
});
