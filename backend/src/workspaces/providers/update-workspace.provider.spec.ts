import { UpdateWorkspaceProvider } from './update-workspace.provider';
import { FindWorkspaceByIdProvider } from './find-workspace-by-id.provider';
import { WorkspaceType } from '../enums/workspace-type.enum';

describe('UpdateWorkspaceProvider', () => {
  let provider: UpdateWorkspaceProvider;
  let workspacesRepository: any;
  let findWorkspaceByIdProvider: jest.Mocked<
    Partial<FindWorkspaceByIdProvider>
  >;

  beforeEach(() => {
    workspacesRepository = { save: jest.fn() };
    findWorkspaceByIdProvider = { findById: jest.fn() };

    provider = new UpdateWorkspaceProvider(
      workspacesRepository,
      findWorkspaceByIdProvider as any,
    );
  });

  const existingWorkspace = {
    id: 'ws-1',
    name: 'Hot Desk A',
    type: WorkspaceType.HOT_DESK,
    totalSeats: 10,
    availableSeats: 5,
    hourlyRate: 50000,
    isActive: true,
    description: null,
    amenities: null,
    images: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  it('updates workspace fields', async () => {
    findWorkspaceByIdProvider.findById.mockResolvedValue({
      ...existingWorkspace,
    });
    workspacesRepository.save.mockImplementation((ws) => Promise.resolve(ws));

    const result = await provider.update('ws-1', {
      name: 'Updated Desk',
    } as any);

    expect(result.name).toBe('Updated Desk');
    expect(workspacesRepository.save).toHaveBeenCalled();
  });

  it('increases availableSeats proportionally when totalSeats increased', async () => {
    findWorkspaceByIdProvider.findById.mockResolvedValue({
      ...existingWorkspace,
    });
    workspacesRepository.save.mockImplementation((ws) => Promise.resolve(ws));

    const result = await provider.update('ws-1', { totalSeats: 15 } as any);

    expect(result.availableSeats).toBe(10); // 5 + (15 - 10)
  });

  it('does not change availableSeats when totalSeats unchanged', async () => {
    findWorkspaceByIdProvider.findById.mockResolvedValue({
      ...existingWorkspace,
    });
    workspacesRepository.save.mockImplementation((ws) => Promise.resolve(ws));

    const result = await provider.update('ws-1', {
      description: 'Updated description',
    } as any);

    expect(result.availableSeats).toBe(5);
  });

  it('does not change availableSeats when totalSeats decreased', async () => {
    findWorkspaceByIdProvider.findById.mockResolvedValue({
      ...existingWorkspace,
    });
    workspacesRepository.save.mockImplementation((ws) => Promise.resolve(ws));

    const result = await provider.update('ws-1', { totalSeats: 5 } as any);

    expect(result.availableSeats).toBe(5); // unchanged since decreased
  });
});
