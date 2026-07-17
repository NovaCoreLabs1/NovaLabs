import { PdfInvoiceProvider } from './pdf-invoice.provider';
import { InvoiceStatus } from '../enums/invoice-status.enum';

// Mock PDFDocument
const mockPdfMethods = {
  fontSize: jest.fn().mockReturnThis(),
  font: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  moveDown: jest.fn().mockReturnThis(),
  moveTo: jest.fn().mockReturnThis(),
  lineTo: jest.fn().mockReturnThis(),
  stroke: jest.fn().mockReturnThis(),
  fillColor: jest.fn().mockReturnThis(),
  currentLineHeight: jest.fn().mockReturnValue(14),
  on: jest.fn(),
  end: jest.fn(),
};

jest.mock('pdfkit', () => {
  const MockPDFDocument = jest.fn().mockImplementation(() => mockPdfMethods);
  return MockPDFDocument;
});

describe('PdfInvoiceProvider', () => {
  let provider: PdfInvoiceProvider;

  beforeEach(() => {
    provider = new PdfInvoiceProvider();
    jest.clearAllMocks();

    // Set up event handlers
    mockPdfMethods.on.mockImplementation((event: string, handler: Function) => {
      if (event === 'data') {
        // Don't trigger data — just resolve
      }
      if (event === 'end') {
        // Don't trigger end — just set up
      }
      return mockPdfMethods;
    });
  });

  const mockInvoice = {
    id: 'inv-1',
    invoiceNumber: 'INV-00001',
    amountKobo: 500000,
    status: InvoiceStatus.PAID,
    createdAt: new Date('2024-01-15'),
    lineItems: null,
  } as any;

  it('generates a PDF buffer', async () => {
    // Simulate successful PDF generation
    mockPdfMethods.on.mockImplementation((event: string, handler: Function) => {
      if (event === 'end') {
        setTimeout(() => handler(), 10);
      }
      return mockPdfMethods;
    });

    const result = await provider.generate(mockInvoice);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(mockPdfMethods.fontSize).toHaveBeenCalled();
    expect(mockPdfMethods.text).toHaveBeenCalled();
    expect(mockPdfMethods.end).toHaveBeenCalled();
  });

  it('renders invoice with line items when present', async () => {
    mockPdfMethods.on.mockImplementation((event: string, handler: Function) => {
      if (event === 'end') {
        setTimeout(() => handler(), 10);
      }
      return mockPdfMethods;
    });

    const invoiceWithItems = {
      ...mockInvoice,
      lineItems: [
        {
          description: 'Hot Desk A — monthly booking',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          amountNaira: 5000,
        },
      ],
    };

    const result = await provider.generate(invoiceWithItems);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('handles PDF generation errors', async () => {
    mockPdfMethods.on.mockImplementation((event: string, handler: Function) => {
      if (event === 'error') {
        setTimeout(() => handler(new Error('PDF error')), 10);
      }
      return mockPdfMethods;
    });

    await expect(provider.generate(mockInvoice)).rejects.toThrow('PDF error');
  });
});
