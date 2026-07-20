import { BadRequestException, NotFoundException } from '@nestjs/common';
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
    };
    workspacesRepository = {
      findOne: jest.fn(),
    };

    provider = new CheckInProvider(logsRepository, workspacesRepository);
  });

  // ─────────────────────────────────────
  // validateBiometricPrivacy (indirectly tested via checkIn)
  // ─────────────────────────────────────
  describe('checkIn - biometric validation', () => {
    const baseDto = { workspaceId: 'ws-1' };

    it('rejects raw biometricTemplate', async () => {
      await expect(
        provider.checkIn(
          { ...baseDto, biometricTemplate: 'raw-data' } as any,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(logsRepository.save).not.toHaveBeenCalled();
    });

    it('rejects biometricTemplateData', async () => {
      await expect(
        provider.checkIn(
          { ...baseDto, biometricTemplateData: 'raw-data' } as any,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects rawBiometricTemplate', async () => {
      await expect(
        provider.checkIn(
          { ...baseDto, rawBiometricTemplate: 'raw-data' } as any,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects biometricSample', async () => {
      await expect(
        provider.checkIn(
          { ...baseDto, biometricSample: 'raw-data' } as any,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects biometricPayload', async () => {
      await expect(
        provider.checkIn(
          { ...baseDto, biometricPayload: 'raw-data' } as any,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects fingerprintTemplate', async () => {
      await expect(
        provider.checkIn(
          { ...baseDto, fingerprintTemplate: 'raw-data' } as any,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects faceTemplate', async () => {
      await expect(
        provider.checkIn(
          { ...baseDto, faceTemplate: 'raw-data' } as any,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when biometricProcessingLocation=vendor but no vendor name', async () => {
      await expect(
        provider.checkIn(
          {
            ...baseDto,
            biometricProcessingLocation: 'vendor',
            biometricVendor: '',
          } as any,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows vendor processing when vendor name supplied', async () => {
      workspacesRepository.findOne.mockResolvedValue({
        id: 'ws-1',
        isActive: true,
      });
      logsRepository.findOne.mockResolvedValue(null);
      logsRepository.create.mockReturnValue({ id: 'log-1' });
      logsRepository.save.mockResolvedValue({ id: 'log-1' });

      const result = await provider.checkIn(
        {
          ...baseDto,
          biometricProcessingLocation: 'vendor',
          biometricVendor: 'AcmeBio',
        } as any,
        'user-1',
      );
      expect(result).toEqual({ id: 'log-1' });
    });
  });

  // ─────────────────────────────────────
  // checkIn — workspace / duplicate checks
  // ─────────────────────────────────────
  describe('checkIn - workspace and duplicate validation', () => {
    const validDto = { workspaceId: 'ws-1' };

    beforeEach(() => {
      workspacesRepository.findOne.mockResolvedValue({
        id: 'ws-1',
        isActive: true,
      });
    });

    it('throws NotFoundException when workspace does not exist', async () => {
      workspacesRepository.findOne.mockResolvedValue(null);
      await expect(provider.checkIn(validDto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when duplicate active check-in exists', async () => {
      logsRepository.findOne.mockResolvedValue({ id: 'existing-log' });
      await expect(provider.checkIn(validDto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates a log entry successfully with minimal fields', async () => {
      logsRepository.findOne.mockResolvedValue(null);
      logsRepository.create.mockReturnValue({ id: 'log-1' });
      logsRepository.save.mockResolvedValue({ id: 'log-1' });

      const result = await provider.checkIn(validDto, 'user-1');
      expect(result).toEqual({ id: 'log-1' });
      expect(logsRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        workspaceId: 'ws-1',
        bookingId: null,
        notes: null,
        biometricTemplateHash: null,
        biometricStorageReference: null,
        biometricProcessingLocation: null,
        biometricVendor: null,
      });
    });

    it('creates a log entry with all optional fields', async () => {
      const fullDto = {
        workspaceId: 'ws-1',
        bookingId: 'booking-1',
        notes: 'Working on project X',
        biometricTemplateHash: 'hashed-value',
        biometricStorageReference: 'ref-123',
        biometricProcessingLocation: 'local' as const,
        biometricVendor: 'BuiltIn',
      };
      logsRepository.findOne.mockResolvedValue(null);
      logsRepository.create.mockReturnValue({ id: 'log-2' });
      logsRepository.save.mockResolvedValue({ id: 'log-2' });

      const result = await provider.checkIn(fullDto, 'user-1');
      expect(result).toEqual({ id: 'log-2' });
      expect(logsRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        workspaceId: 'ws-1',
        bookingId: 'booking-1',
        notes: 'Working on project X',
        biometricTemplateHash: 'hashed-value',
        biometricStorageReference: 'ref-123',
        biometricProcessingLocation: 'local',
        biometricVendor: 'BuiltIn',
      });
    });
  });

  // ─────────────────────────────────────
  // checkOut
  // ─────────────────────────────────────
  describe('checkOut', () => {
    it('throws NotFoundException when no active log found', async () => {
      logsRepository.findOne.mockResolvedValue(null);
      await expect(provider.checkOut('log-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('calculates duration and updates the log on successful checkout', async () => {
      const now = new Date();
      const checkInTime = new Date(now.getTime() - 90 * 60 * 1000); // 90 min ago
      logsRepository.findOne.mockResolvedValue({
        id: 'log-1',
        userId: 'user-1',
        checkedInAt: checkInTime,
        checkedOutAt: null,
        durationMinutes: null,
      });
      logsRepository.save.mockImplementation((log) => Promise.resolve(log));

      const result = await provider.checkOut('log-1', 'user-1');
      expect(result.checkedOutAt).toBeDefined();
      expect(result.durationMinutes).toBe(90);
      expect(logsRepository.save).toHaveBeenCalled();
    });

    it('handles checkouts that span exactly 0 minutes', async () => {
      const now = new Date();
      logsRepository.findOne.mockResolvedValue({
        id: 'log-1',
        userId: 'user-1',
        checkedInAt: now,
        checkedOutAt: null,
        durationMinutes: null,
      });
      logsRepository.save.mockImplementation((log) => Promise.resolve(log));

      const result = await provider.checkOut('log-1', 'user-1');
      expect(result.durationMinutes).toBe(0);
    });
  });

  // ─────────────────────────────────────
  // getActiveCheckIn
  // ─────────────────────────────────────
  describe('getActiveCheckIn', () => {
    it('returns active check-in for user', async () => {
      logsRepository.findOne.mockResolvedValue({ id: 'log-1' });
      const result = await provider.getActiveCheckIn('user-1');
      expect(result).toEqual({ id: 'log-1' });
      // checkedOutAt uses IsNull() from typeorm, which is a FindOperator
      expect(logsRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1', checkedOutAt: expect.any(Object) },
      });
    });

    it('filters by workspaceId when provided', async () => {
      logsRepository.findOne.mockResolvedValue({ id: 'log-1' });
      const result = await provider.getActiveCheckIn('user-1', 'ws-1');
      expect(result).toEqual({ id: 'log-1' });
      expect(logsRepository.findOne).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          workspaceId: 'ws-1',
          checkedOutAt: expect.any(Object),
        },
      });
    });

    it('returns null when no active check-in exists', async () => {
      logsRepository.findOne.mockResolvedValue(null);
      const result = await provider.getActiveCheckIn('user-1');
      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────
  // getStorageAuditSummary
  // ─────────────────────────────────────
  describe('getStorageAuditSummary', () => {
    it('returns a privacy-focused summary', async () => {
      logsRepository.count
        .mockResolvedValueOnce(10) // totalLogs
        .mockResolvedValueOnce(3) // logsWithHashedTemplates
        .mockResolvedValueOnce(2); // logsWithOpaqueStorageRefs

      const summary = await provider.getStorageAuditSummary();
      expect(summary).toEqual({
        totalLogs: 10,
        logsWithHashedTemplates: 3,
        logsWithOpaqueStorageRefs: 2,
        rawBiometricRows: 0,
        storagePolicy: 'hash-only-or-opaque-reference',
        recommendedProcessing: 'local-processing-preferred',
      });
    });

    it('handles empty dataset gracefully', async () => {
      logsRepository.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const summary = await provider.getStorageAuditSummary();
      expect(summary.totalLogs).toBe(0);
      expect(summary.logsWithHashedTemplates).toBe(0);
      expect(summary.logsWithOpaqueStorageRefs).toBe(0);
    });
  });
});
