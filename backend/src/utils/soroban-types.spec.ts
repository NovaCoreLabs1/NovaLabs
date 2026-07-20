import { scValToNative } from '@stellar/stellar-sdk';
import { mapScValToescrow, mapScValToescrowStatus } from './soroban-types';

jest.mock('@stellar/stellar-sdk', () => ({
  scValToNative: jest.fn(),
}));

describe('soroban-types', () => {
  describe('mapScValToescrow', () => {
    it('maps a Soroban ScVal map to a plain JS object', () => {
      const mockSymKey = (val: string) => ({
        sym: () => ({ toString: () => val }),
      });
      const mockEntry = (key: string, val: any) => ({
        key: () => mockSymKey(key),
        val: () => val,
      });

      const mockScVal = {
        map: () => [
          mockEntry('amount', '1000'),
          mockEntry('status', 'pending'),
          mockEntry('depositor', 'GABCDEF123'),
        ],
      };

      (scValToNative as jest.Mock)
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce('pending')
        .mockReturnValueOnce('GABCDEF123');

      const result = mapScValToescrow(mockScVal);

      expect(result).toEqual({
        amount: 1000,
        status: 'pending',
        depositor: 'GABCDEF123',
      });
      expect(scValToNative).toHaveBeenCalledTimes(3);
    });

    it('handles an empty map', () => {
      const mockScVal = { map: () => [] };

      const result = mapScValToescrow(mockScVal);

      expect(result).toEqual({});
    });
  });

  describe('mapScValToescrowStatus', () => {
    const mockSym = (val: string) => ({
      sym: () => ({ toString: () => val }),
    });

    it('maps "pending" to "Pending"', () => {
      expect(mapScValToescrowStatus(mockSym('pending'))).toBe('Pending');
    });

    it('maps "released" to "Released"', () => {
      expect(mapScValToescrowStatus(mockSym('released'))).toBe('Released');
    });

    it('maps "refunded" to "Refunded"', () => {
      expect(mapScValToescrowStatus(mockSym('refunded'))).toBe('Refunded');
    });

    it('maps "disputed" to "Disputed"', () => {
      expect(mapScValToescrowStatus(mockSym('disputed'))).toBe('Disputed');
    });

    it('maps unknown status to "Unknown"', () => {
      expect(mapScValToescrowStatus(mockSym('cancelled'))).toBe('Unknown');
    });
  });
});
