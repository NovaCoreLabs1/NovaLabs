import { InvoiceSequenceProvider } from './invoice-sequence.provider';

describe('InvoiceSequenceProvider', () => {
  let provider: InvoiceSequenceProvider;
  let dataSource: any;

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    provider = new InvoiceSequenceProvider(dataSource);
  });

  describe('onApplicationBootstrap', () => {
    it('creates the invoice_number_seq on startup', async () => {
      dataSource.query.mockResolvedValue(undefined);

      await provider.onApplicationBootstrap();

      expect(dataSource.query).toHaveBeenCalledWith(
        `CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1`,
      );
    });

    it('handles errors gracefully without throwing', async () => {
      dataSource.query.mockRejectedValue(new Error('Connection failed'));

      // Should not throw
      await expect(provider.onApplicationBootstrap()).resolves.toBeUndefined();
    });
  });
});
