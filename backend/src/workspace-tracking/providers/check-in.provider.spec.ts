import { BadRequestException } from '@nestjs/common';
import { CheckInProvider } from './check-in.provider';

describe('CheckInProvider', () => {
  let provider: CheckInProvider;
  let logsRepository: any;
  let workspacesRepository: any;

  beforeEach(() => {
    logsRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    workspacesRepository = {
      findOne: jest.fn(),
    };

    provider = new CheckInProvider(logsRepository, workspacesRepository);
  });

  it('rejects raw biometric payloads before any workspace log is persisted', async () => {
    workspacesRepository.findOne.mockResolvedValue({
      id: 'ws-1',
      isActive: true,
    });
    logsRepository.findOne.mockResolvedValue(null);

    await expect(
      provider.checkIn(
        {
          workspaceId: 'ws-1',
          biometricTemplate: 'raw-template-data',
        } as any,
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(logsRepository.save).not.toHaveBeenCalled();
  });

  it('returns a privacy-focused storage audit summary', async () => {
    logsRepository.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const summary = await provider.getStorageAuditSummary();

    expect(summary).toEqual({
      totalLogs: 3,
      logsWithHashedTemplates: 1,
      logsWithOpaqueStorageRefs: 1,
      rawBiometricRows: 0,
      storagePolicy: 'hash-only-or-opaque-reference',
      recommendedProcessing: 'local-processing-preferred',
    });
  });
});
