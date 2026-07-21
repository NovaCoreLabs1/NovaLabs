import { SorobanRpc, Transaction } from '@stellar/stellar-sdk';

/**
 * Subset of SorobanRpc.Server methods used by SorobanEscrowProvider.
 * Abstracted so that a fake can be injected during tests.
 */
export interface SorobanRpcClientInterface {
  prepareTransaction(tx: Transaction): Promise<Transaction>;
  sendTransaction(
    tx: Transaction,
  ): Promise<SorobanRpc.Api.SendTransactionResponse>;
  getTransaction(hash: string): Promise<SorobanRpc.Api.GetTransactionResponse>;
  simulateTransaction(
    tx: Transaction,
  ): Promise<SorobanRpc.Api.SimulateTransactionResponse>;
  getAccount(accountId: string): Promise<any>;
}

export const SOROBAN_RPC_CLIENT = 'SOROBAN_RPC_CLIENT';
