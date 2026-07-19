import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { GenerateInvoiceProvider } from './providers/generate-invoice.provider';
import { FindInvoicesProvider } from './providers/find-invoices.provider';
import { PdfInvoiceProvider } from './providers/pdf-invoice.provider';
import { UserRole } from '../users/enums/userRoles.enum';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let generateProvider: jest.Mocked<Partial<GenerateInvoiceProvider>>;
  let findProvider: jest.Mocked<Partial<FindInvoicesProvider>>;
  let pdfProvider: jest.Mocked<Partial<PdfInvoiceProvider>>;

  beforeEach(async () => {
    generateProvider = { generateForPayment: jest.fn() };
    findProvider = { findAll: jest.fn(), findById: jest.fn() };
    pdfProvider = { generate: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: GenerateInvoiceProvider, useValue: generateProvider },
        { provide: FindInvoicesProvider, useValue: findProvider },
        { provide: PdfInvoiceProvider, useValue: pdfProvider },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  describe('generateForPayment', () => {
    it('delegates to GenerateInvoiceProvider', async () => {
      generateProvider.generateForPayment.mockResolvedValue({
        id: 'inv-1',
      } as any);

      const result = await service.generateForPayment('payment-1');
      expect(result).toEqual({ id: 'inv-1' });
      expect(generateProvider.generateForPayment).toHaveBeenCalledWith(
        'payment-1',
      );
    });
  });

  describe('findAll', () => {
    it('delegates to FindInvoicesProvider', async () => {
      findProvider.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      const result = await service.findAll({}, 'user-1', UserRole.USER);
      expect(result.total).toBe(0);
      expect(findProvider.findAll).toHaveBeenCalledWith(
        {},
        'user-1',
        UserRole.USER,
      );
    });
  });

  describe('findById', () => {
    it('delegates to FindInvoicesProvider', async () => {
      findProvider.findById.mockResolvedValue({ id: 'inv-1' } as any);

      const result = await service.findById('inv-1', 'user-1', UserRole.USER);
      expect(result).toEqual({ id: 'inv-1' });
      expect(findProvider.findById).toHaveBeenCalledWith(
        'inv-1',
        'user-1',
        UserRole.USER,
      );
    });
  });

  describe('downloadPdf', () => {
    it('generates PDF from found invoice', async () => {
      const invoice = {
        id: 'inv-1',
        invoiceNumber: 'INV-00001',
      };
      findProvider.findById.mockResolvedValue(invoice as any);
      pdfProvider.generate.mockResolvedValue(Buffer.from('pdf-content'));

      const result = await service.downloadPdf(
        'inv-1',
        'user-1',
        UserRole.USER,
      );

      expect(result.pdf).toBeDefined();
      expect(result.invoiceNumber).toBe('INV-00001');
      expect(findProvider.findById).toHaveBeenCalledWith(
        'inv-1',
        'user-1',
        UserRole.USER,
      );
      expect(pdfProvider.generate).toHaveBeenCalledWith(invoice);
    });
  });
});
