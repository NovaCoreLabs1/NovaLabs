import { NotFoundException } from '@nestjs/common';
import { FindWorkspaceByIdProvider } from './find-workspace-by-id.provider';

describe('FindWorkspaceByIdProvider', () => {
  let provider: FindWorkspaceByIdProvider;
  let workspacesRepository: any;

  beforeEach(() => {
    workspacesRepository = { findOne: jest.fn() };
    provider = new FindWorkspaceByIdProvider(workspacesRepository);
  });

  it('returns workspace when found', async () => {
    const workspace = { id: 'ws-1', name: 'Hot Desk A' };
    workspacesRepository.findOne.mockResolvedValue(workspace);

    const result = await provider.findById('ws-1');
    expect(result).toEqual(workspace);
    expect(workspacesRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'ws-1' },
    });
  });

  it('throws NotFoundException when workspace does not exist', async () => {
    workspacesRepository.findOne.mockResolvedValue(null);

    await expect(provider.findById('unknown')).rejects.toThrow(
      NotFoundException,
    );
  });
});
