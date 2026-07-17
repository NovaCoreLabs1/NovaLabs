import { CheckWorkspaceAvailabilityProvider } from './check-workspace-availability.provider';
import { FindWorkspaceByIdProvider } from './find-workspace-by-id.provider';

describe('CheckWorkspaceAvailabilityProvider', () => {
  let provider: CheckWorkspaceAvailabilityProvider;
  let workspacesRepository: any;
  let findWorkspaceByIdProvider: jest.Mocked<Partial<FindWorkspaceByIdProvider>>;

  beforeEach(() => {
    workspacesRepository = {};
    findWorkspaceByIdProvider = { findById: jest.fn() };

    provider = new CheckWorkspaceAvailabilityProvider(
      workspacesRepository,
      findWorkspaceByIdProvider as any,
    );
  });

  it('returns available when enough seats', async () => {
    findWorkspaceByIdProvider.findById.mockResolvedValue({
      id: 'ws-1',
      name: 'Test Workspace',
      type: 'HotDesk',
      isActive: true,
      availableSeats: 10,
      totalSeats: 20,
      hourlyRate: 50000,
      description: null,
      amenities: null,
      images: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await provider.check('ws-1', 5);

    expect(result.available).toBe(true);
    expect(result.availableSeats).toBe(10);
    expect(result.totalSeats).toBe(20);
    expect(result.message).toBeUndefined();
  });

  it('returns not available when insufficient seats', async () => {
    findWorkspaceByIdProvider.findById.mockResolvedValue({
      id: 'ws-1',
      name: 'Test Workspace',
      type: 'HotDesk',
      isActive: true,
      availableSeats: 2,
      totalSeats: 20,
      hourlyRate: 50000,
      description: null,
      amenities: null,
      images: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await provider.check('ws-1', 5);

    expect(result.available).toBe(false);
    expect(result.message).toBe('Only 2 seats available');
  });

  it('returns not available when workspace is inactive', async () => {
    findWorkspaceByIdProvider.findById.mockResolvedValue({
      id: 'ws-1',
      name: 'Test Workspace',
      type: 'HotDesk',
      isActive: false,
      availableSeats: 10,
      totalSeats: 20,
      hourlyRate: 50000,
      description: null,
      amenities: null,
      images: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await provider.check('ws-1', 5);

    expect(result.available).toBe(false);
    expect(result.availableSeats).toBe(0);
    expect(result.message).toBe('Workspace is not active');
  });

  it('defaults to 1 requested seat when not specified', async () => {
    findWorkspaceByIdProvider.findById.mockResolvedValue({
      id: 'ws-1',
      name: 'Test Workspace',
      type: 'HotDesk',
      isActive: true,
      availableSeats: 1,
      totalSeats: 1,
      hourlyRate: 50000,
      description: null,
      amenities: null,
      images: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await provider.check('ws-1');

    expect(result.available).toBe(true);
  });

  it('returns not available when workspace not found (delegated)', async () => {
    findWorkspaceByIdProvider.findById.mockRejectedValue(
      new Error('Not found'),
    );

    await expect(provider.check('unknown', 1)).rejects.toThrow('Not found');
  });
});
