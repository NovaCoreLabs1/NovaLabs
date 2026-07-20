import { ConflictException } from '@nestjs/common';
import { CreateWorkspaceProvider } from './create-workspace.provider';
import { WorkspaceType } from '../enums/workspace-type.enum';

describe('CreateWorkspaceProvider', () => {
  let provider: CreateWorkspaceProvider;
  let workspacesRepository: any;

  beforeEach(() => {
    workspacesRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    provider = new CreateWorkspaceProvider(workspacesRepository);
  });

  const validDto = {
    name: 'Hot Desk A',
    type: WorkspaceType.HOT_DESK,
    totalSeats: 10,
    hourlyRate: 50000,
  };

  it('creates a workspace successfully', async () => {
    workspacesRepository.findOne.mockResolvedValue(null);
    workspacesRepository.create.mockReturnValue({ id: 'ws-1', ...validDto });
    workspacesRepository.save.mockResolvedValue({ id: 'ws-1', ...validDto });

    const result = await provider.create(validDto);

    expect(result).toEqual({ id: 'ws-1', ...validDto });
    expect(workspacesRepository.create).toHaveBeenCalledWith({
      ...validDto,
      availableSeats: validDto.totalSeats,
    });
  });

  it('throws ConflictException when workspace name already exists and is active', async () => {
    workspacesRepository.findOne.mockResolvedValue({ id: 'existing' });

    await expect(provider.create(validDto)).rejects.toThrow(ConflictException);
    expect(workspacesRepository.save).not.toHaveBeenCalled();
  });

  it('includes optional fields when provided', async () => {
    const fullDto = {
      ...validDto,
      description: 'A great desk',
      amenities: ['WiFi', 'Power'],
      images: ['https://example.com/img.jpg'],
    };

    workspacesRepository.findOne.mockResolvedValue(null);
    workspacesRepository.create.mockReturnValue({ id: 'ws-2', ...fullDto });
    workspacesRepository.save.mockResolvedValue({ id: 'ws-2', ...fullDto });

    const result = await provider.create(fullDto as any);
    expect(result).toEqual({ id: 'ws-2', ...fullDto });
    expect(workspacesRepository.create).toHaveBeenCalledWith({
      ...fullDto,
      availableSeats: validDto.totalSeats,
    });
  });
});
