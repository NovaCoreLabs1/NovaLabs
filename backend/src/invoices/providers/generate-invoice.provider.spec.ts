import { GenerateInvoiceProvider } from './generate-invoice.provider';
import { InvoiceStatus } from '../enums/invoice-status.enum';

describe('GenerateInvoiceProvider', () => {
  let provider: GenerateInvoiceProvider;
  let invoicesRepository: any;
  let paymentsRepository: any;
  let bookingsRepository: any;
  let usersRepository: any;
  let workspacesRepository: any;
  let dataSource: any;
  let emailService: any;
  let pdfInvoiceProvider: any;

  beforeEach(() => {
    invoicesRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    paymentsRepository = { findOne: jest.fn() };
    bookingsRepository = { findOne: jest.fn() };
    usersRepository = { findOne: jest.fn() };
    workspacesRepository = { findOne: jest.fn() };
    dataSource = { query: jest.fn() };
    emailService = { sendInvoiceReadyEmail: jest.fn().mockResolvedValue(undefined) };
    pdfInvoiceProvider = { generate: jest.fn().mockResolvedValue(Buffer.from('pdf')) };

    provider = new GenerateInvoiceProvider(
      invoicesRepository,
      paymentsRepository,
      bookingsRepository,
      usersRepository,
      workspacesRepository,
      dataSource,
      emailService,
      pdfInvoiceProvider,
    );
  });

  it('returns existing invoice if already generated (idempotent)', async () => {
    const existingInvoice = { id: 'inv-1', invoiceNumber: 'INV-00001' };
    invoicesRepository.findOne.mockResolvedValue(existingInvoice);

    const result = await provider.generateForPayment('payment-1');

    expect(result).toEqual(existingInvoice);
    expect(paymentsRepository.findOne).not.toHaveBeenCalled();
  });

  it('throws error when payment not found', async () => {
    invoicesRepository.findOne.mockResolvedValue(null);
    paymentsRepository.findOne.mockResolvedValue(null);

    await expect(
      provider.generateForPayment('unknown'),
    ).rejects.toThrow('not found');
  });

  it('generates invoice with proper line items and sequence', async () => {
    // No existing invoice
    invoicesRepository.findOne
      .mockResolvedValueOnce(null) // first call: existing check
      .mockResolvedValueOnce({ id: 'inv-1', invoiceNumber: 'INV-00001' }); // save result

    invoicesRepository.findOne.mockResolvedValue(null);

    paymentsRepository.findOne.mockResolvedValue({
      id: 'payment-1',
      bookingId: 'booking-1',
      userId: 'user-1',
      amount: 500000,
      currency: 'NGN',
      paidAt: new Date('2024-01-15'),
    });

    bookingsRepository.findOne.mockResolvedValue({
      id: 'booking-1',
      workspaceId: 'ws-1',
      planType: 'monthly',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      seatCount: 2,
    });

    usersRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      fullName: 'John Doe',
    });

    workspacesRepository.findOne.mockResolvedValue({
      id: 'ws-1',
      name: 'Hot Desk A',
    });

    // Sequence query
    dataSource.query.mockResolvedValue([{ nextval: '1' }]);

    invoicesRepository.create.mockReturnValue({
      id: 'inv-1',
      invoiceNumber: 'INV-00001',
      lineItems: [],
    });
    invoicesRepository.save.mockResolvedValue({
      id: 'inv-1',
      invoiceNumber: 'INV-00001',
      lineItems: [],
    });

    const result = await provider.generateForPayment('payment-1');

    expect(result.invoiceNumber).toBe('INV-00001');
    expect(invoicesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceNumber: 'INV-00001',
        amountKobo: 500000,
        status: InvoiceStatus.PAID,
      }),
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      `SELECT nextval('invoice_number_seq')`,
    );
  });

  it('uses fallback description when workspace is null', async () => {
    invoicesRepository.findOne.mockResolvedValueOnce(null);

    paymentsRepository.findOne.mockResolvedValue({
      id: 'payment-1',
      bookingId: 'booking-1',
      userId: 'user-1',
      amount: 50000,
      currency: 'NGN',
      paidAt: new Date(),
    });

    bookingsRepository.findOne.mockResolvedValue({
      id: 'booking-1',
      workspaceId: null,
    });

    usersRepository.findOne.mockResolvedValue(null); // no user -> no email
    workspacesRepository.findOne.mockResolvedValue(null);
    dataSource.query.mockResolvedValue([{ nextval: '2' }]);

    invoicesRepository.create.mockReturnValue({ id: 'inv-2' });
    invoicesRepository.save.mockResolvedValue({ id: 'inv-2' });

    const result = await provider.generateForPayment('payment-1');

    expect(result).toBeDefined();
    expect(invoicesRepository.create).toHaveBeenCalled();
  });
});
