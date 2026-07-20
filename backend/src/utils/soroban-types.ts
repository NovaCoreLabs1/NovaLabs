/* eslint-disable @typescript-eslint/no-explicit-any */
import { scValToNative } from '@stellar/stellar-sdk';

/**
 * Maps a Soroban ScVal map representing an escrow object to a plain JS object.
 * Iterates over the map entries and converts each value using scValToNative.
 * @param scVal - The Soroban ScVal of type 'map'
 * @returns A plain object with string keys and native JS values
 */
export function mapScValToescrow(scVal: any): any {
  const escrowMap = scVal.map();
  const escrow: any = {};
  for (const entry of escrowMap) {
    const key = entry.key().sym().toString();
    const value = entry.val();
    escrow[key] = scValToNative(value);
  }
  return escrow;
}

/**
 * Maps a Soroban ScVal symbol representing escrow status to a human-readable string.
 * @param scVal - The Soroban ScVal of type 'sym'
 * @returns One of: 'Pending' | 'Released' | 'Refunded' | 'Disputed' | 'Unknown'
 */
export function mapScValToescrowStatus(scVal: any): string {
  const statusSymbol = scVal.sym().toString();
  switch (statusSymbol) {
    case 'pending':
      return 'Pending';
    case 'released':
      return 'Released';
    case 'refunded':
      return 'Refunded';
    case 'disputed':
      return 'Disputed';
    default:
      return 'Unknown';
  }
}
