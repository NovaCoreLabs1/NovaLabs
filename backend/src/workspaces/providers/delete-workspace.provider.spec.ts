import { DeleteWorkspaceProvider } from './delete-workspace.provider';
import { FindWorkspaceByIdProvider } from './find-workspace-by-id.provider';

describe('DeleteWorkspaceProvider', () => {
  let provider: DeleteWorkspaceProvider;
  let workspacesRepository: any;
  let findWorkspaceByIdProvider: jest.Mocked<
    Partial<FindWorkspaceByIdProvider>
  >;

  beforeEach(() => {
    workspacesRepository = { save: jest.fn() };
    findWorkspaceByIdProvider = { findById: jest.fn() };

    provider = new DeleteWorkspaceProvider(
      workspacesRepository,
      findWorkspaceByIdProvider as any,
    );
  });

  it('soft-deletes a workspace by setting isActive to false', async () => {
    const workspace: any = { id: 'ws-1', isActive: true };
    findWorkspaceByIdProvider.findById.mockResolvedValue(workspace);
    workspacesRepository.save.mockResolvedValue(workspace);

    await provider.softDelete('ws-1');

    expect(workspace.isActive).toBe(false);
    expect(workspacesRepository.save).toHaveBeenCalledWith(workspace);
  });

  it('throws when workspace not found (delegated to findWorkspaceByIdProvider)', async () => {
    findWorkspaceByIdProvider.findById.mockRejectedValue(
      new Error('Not found'),
    );

    await expect(provider.softDelete('unknown')).rejects.toThrow('Not found');
    expect(workspacesRepository.save).not.toHaveBeenCalled();
  });
});
