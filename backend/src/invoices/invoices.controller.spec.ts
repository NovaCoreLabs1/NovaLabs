import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { UserRole } from '../users/enums/userRoles.enum';

describe('InvoicesController', () => {
  let controller: InvoicesController;
  let service: jest.Mocked<Partial<InvoicesService>>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findById: jest.fn(),
      downloadPdf: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [{ provide: InvoicesService, useValue: service }],
    }).compile();

    controller = module.get<InvoicesController>(InvoicesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('returns paginated invoices with message', async () => {
      const paginated = {
        data: [{ id: 'inv-1' }],
        total: 1,
        page: 1,
        limit: 20,
      } as any;
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({} as any, 'user-1', UserRole.USER);
      expect(result).toEqual({
        message: 'Invoices retrieved successfully',
        ...paginated,
      });
      expect(service.findAll).toHaveBeenCalledWith({}, 'user-1', UserRole.USER);
    });
  });

  describe('findOne', () => {
    it('returns invoice by id', async () => {
      service.findById.mockResolvedValue({ id: 'inv-1' } as any);

      const result = await controller.findOne('inv-1', 'user-1', UserRole.USER);
      expect(result).toEqual({
        message: 'Invoice retrieved successfully',
        data: { id: 'inv-1' },
      });
      expect(service.findById).toHaveBeenCalledWith('inv-1', 'user-1', UserRole.USER);
    });
  });
});
