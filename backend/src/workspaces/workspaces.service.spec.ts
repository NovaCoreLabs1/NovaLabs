import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceProvider } from './providers/create-workspace.provider';
import { FindAllWorkspacesProvider } from './providers/find-all-workspaces.provider';
import { FindWorkspaceByIdProvider } from './providers/find-workspace-by-id.provider';
import { UpdateWorkspaceProvider } from './providers/update-workspace.provider';
import { DeleteWorkspaceProvider } from './providers/delete-workspace.provider';
import { CheckWorkspaceAvailabilityProvider } from './providers/check-workspace-availability.provider';
import { WorkspaceType } from './enums/workspace-type.enum';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let createProvider: jest.Mocked<Partial<CreateWorkspaceProvider>>;
  let findAllProvider: jest.Mocked<Partial<FindAllWorkspacesProvider>>;
  let findByIdProvider: jest.Mocked<Partial<FindWorkspaceByIdProvider>>;
  let updateProvider: jest.Mocked<Partial<UpdateWorkspaceProvider>>;
  let deleteProvider: jest.Mocked<Partial<DeleteWorkspaceProvider>>;
  let checkAvailabilityProvider: jest.Mocked<Partial<CheckWorkspaceAvailabilityProvider>>;

  beforeEach(async () => {
    createProvider = { create: jest.fn() };
    findAllProvider = { findAll: jest.fn() };
    findByIdProvider = { findById: jest.fn() };
    updateProvider = { update: jest.fn() };
    deleteProvider = { softDelete: jest.fn() };
    checkAvailabilityProvider = { check: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: CreateWorkspaceProvider, useValue: createProvider },
        { provide: FindAllWorkspacesProvider, useValue: findAllProvider },
        { provide: FindWorkspaceByIdProvider, useValue: findByIdProvider },
        { provide: UpdateWorkspaceProvider, useValue: updateProvider },
        { provide: DeleteWorkspaceProvider, useValue: deleteProvider },
        {
          provide: CheckWorkspaceAvailabilityProvider,
          useValue: checkAvailabilityProvider,
        },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  describe('create', () => {
    it('delegates to CreateWorkspaceProvider', async () => {
      const dto = {
        name: 'Hot Desk A',
        type: WorkspaceType.HOT_DESK,
        totalSeats: 10,
        hourlyRate: 50000,
      };
      createProvider.create.mockResolvedValue({ id: 'ws-1', ...dto } as any);

      const result = await service.create(dto);
      expect(result).toEqual({ id: 'ws-1', ...dto });
      expect(createProvider.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('delegates to FindAllWorkspacesProvider', async () => {
      findAllProvider.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const result = await service.findAll({});
      expect(result.total).toBe(0);
      expect(findAllProvider.findAll).toHaveBeenCalledWith({}, false);
    });

    it('passes adminView flag when true', async () => {
      findAllProvider.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await service.findAll({}, true);
      expect(findAllProvider.findAll).toHaveBeenCalledWith({}, true);
    });
  });

  describe('findById', () => {
    it('delegates to FindWorkspaceByIdProvider', async () => {
      findByIdProvider.findById.mockResolvedValue({ id: 'ws-1' } as any);

      const result = await service.findById('ws-1');
      expect(result).toEqual({ id: 'ws-1' });
      expect(findByIdProvider.findById).toHaveBeenCalledWith('ws-1');
    });
  });

  describe('update', () => {
    it('delegates to UpdateWorkspaceProvider', async () => {
      const dto = { name: 'Updated' } as any;
      updateProvider.update.mockResolvedValue({ id: 'ws-1', name: 'Updated' } as any);

      const result = await service.update('ws-1', dto);
      expect(result).toEqual({ id: 'ws-1', name: 'Updated' });
      expect(updateProvider.update).toHaveBeenCalledWith('ws-1', dto);
    });
  });

  describe('softDelete', () => {
    it('delegates to DeleteWorkspaceProvider', async () => {
      deleteProvider.softDelete.mockResolvedValue(undefined);

      await service.softDelete('ws-1');
      expect(deleteProvider.softDelete).toHaveBeenCalledWith('ws-1');
    });
  });

  describe('checkAvailability', () => {
    it('delegates to CheckWorkspaceAvailabilityProvider', async () => {
      checkAvailabilityProvider.check.mockResolvedValue({
        available: true,
        availableSeats: 5,
        totalSeats: 10,
      });

      const result = await service.checkAvailability('ws-1', 3);
      expect(result.available).toBe(true);
      expect(checkAvailabilityProvider.check).toHaveBeenCalledWith('ws-1', 3);
    });

    it('defaults to 1 seat when not specified', async () => {
      checkAvailabilityProvider.check.mockResolvedValue({
        available: true,
        availableSeats: 1,
        totalSeats: 1,
      });

      await service.checkAvailability('ws-1');
      expect(checkAvailabilityProvider.check).toHaveBeenCalledWith('ws-1', undefined);
    });
  });
});
