import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceType } from './enums/workspace-type.enum';

describe('WorkspacesController', () => {
  let controller: WorkspacesController;
  let service: jest.Mocked<Partial<WorkspacesService>>;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      checkAvailability: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [{ provide: WorkspacesService, useValue: service }],
    }).compile();

    controller = module.get<WorkspacesController>(WorkspacesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('delegates to service and returns wrapped response', async () => {
      const dto = {
        name: 'Hot Desk A',
        type: WorkspaceType.HOT_DESK,
        totalSeats: 10,
        hourlyRate: 50000,
      };
      service.create.mockResolvedValue({ id: 'ws-1', ...dto } as any);

      const result = await controller.create(dto);
      expect(result).toEqual({
        message: 'Workspace created successfully',
        data: { id: 'ws-1', ...dto },
      });
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('returns public workspaces with message and result spread', async () => {
      const paginated = {
        data: [{ id: 'ws-1', name: 'Hot Desk A' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as any;
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({});
      expect(result).toEqual({
        message: 'Workspaces retrieved successfully',
        ...paginated,
      });
      expect(service.findAll).toHaveBeenCalledWith({});
    });
  });

  describe('findAllAdmin', () => {
    it('passes adminView=true to service', async () => {
      service.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      } as any);

      const result = await controller.findAllAdmin({});
      expect(result.message).toBe('Workspaces retrieved successfully');
      expect(service.findAll).toHaveBeenCalledWith({}, true);
    });
  });

  describe('findOne', () => {
    it('returns workspace by id with wrapped response', async () => {
      service.findById.mockResolvedValue({ id: 'ws-1', name: 'Hot Desk A' } as any);

      const result = await controller.findOne('ws-1');
      expect(result).toEqual({
        message: 'Workspace retrieved successfully',
        data: { id: 'ws-1', name: 'Hot Desk A' },
      });
      expect(service.findById).toHaveBeenCalledWith('ws-1');
    });
  });

  describe('checkAvailability', () => {
    it('checks availability with default 1 seat', async () => {
      service.checkAvailability.mockResolvedValue({
        available: true,
        availableSeats: 5,
        totalSeats: 10,
      });

      const result = await controller.checkAvailability('ws-1');
      expect(result.message).toBe('Availability checked');
      expect(service.checkAvailability).toHaveBeenCalledWith('ws-1', 1);
    });

    it('parses seats query param as number', async () => {
      service.checkAvailability.mockResolvedValue({
        available: true,
        availableSeats: 5,
        totalSeats: 10,
      });

      await controller.checkAvailability('ws-1', 3 as any);
      expect(service.checkAvailability).toHaveBeenCalledWith('ws-1', 3);
    });
  });

  describe('update', () => {
    it('updates workspace and returns wrapped response', async () => {
      const dto = { name: 'Updated' } as any;
      service.update.mockResolvedValue({ id: 'ws-1', name: 'Updated' } as any);

      const result = await controller.update('ws-1', dto);
      expect(result).toEqual({
        message: 'Workspace updated successfully',
        data: { id: 'ws-1', name: 'Updated' },
      });
      expect(service.update).toHaveBeenCalledWith('ws-1', dto);
    });
  });

  describe('remove', () => {
    it('soft-deletes workspace and returns wrapped response', async () => {
      service.softDelete.mockResolvedValue(undefined);

      const result = await controller.remove('ws-1');
      expect(result).toEqual({
        message: 'Workspace deactivated successfully',
      });
      expect(service.softDelete).toHaveBeenCalledWith('ws-1');
    });
  });
});
