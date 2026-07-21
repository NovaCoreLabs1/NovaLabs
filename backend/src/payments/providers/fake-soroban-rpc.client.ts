import { SorobanRpc, Transaction } from '@stellar/stellar-sdk';
import { SorobanRpcClientInterface } from './soroban-rpc-client.interface';

export interface FakeSorobanRpcOptions {
  /** Transaction hash returned by sendTransaction. Defaults to a deterministic hex string. */
  transactionHash?: string;
  /** If set, getTransaction will return this status. Defaults to SUCCESS. */
  getTransactionStatus?: SorobanRpc.Api.GetTransactionStatus;
  /** If set, simulateTransaction will return this as retval. */
  simulateResult?: any;
  /** If true, simulateTransaction will report failure. */
  simulateFails?: boolean;
  /** If true, getAccount will throw. */
  getAccountFails?: boolean;
}

/**
 * In-memory deterministic fake for SorobanRpc.Server.
 * Returns configurable responses without any network calls.
 */
export class FakeSorobanRpcClient implements SorobanRpcClientInterface {
  private readonly opts: Required<FakeSorobanRpcOptions>;

  /** Records every transaction passed to sendTransaction for assertions. */
  public readonly sentTransactions: Transaction[] = [];
  /** Records every hash passed to getTransaction for assertions. */
  public readonly queriedHashes: string[] = [];

  constructor(options?: FakeSorobanRpcOptions) {
    this.opts = {
      transactionHash: options?.transactionHash ?? 'a'.repeat(64),
      getTransactionStatus:
        options?.getTransactionStatus ??
        SorobanRpc.Api.GetTransactionStatus.SUCCESS,
      simulateResult: options?.simulateResult ?? null,
      simulateFails: options?.simulateFails ?? false,
      getAccountFails: options?.getAccountFails ?? false,
    };
  }

  async prepareTransaction(tx: Transaction): Promise<Transaction> {
    return tx;
  }

  async sendTransaction(
    tx: Transaction,
  ): Promise<SorobanRpc.Api.SendTransactionResponse> {
    this.sentTransactions.push(tx);
    return {
      status: 'PENDING' as SorobanRpc.Api.SendTransactionStatus,
      hash: this.opts.transactionHash,
      latestLedger: 100,
      latestLedgerCloseTime: Math.floor(Date.now() / 1000),
    };
  }

  async getTransaction(
    hash: string,
  ): Promise<SorobanRpc.Api.GetTransactionResponse> {
    this.queriedHashes.push(hash);

    if (
      this.opts.getTransactionStatus ===
      SorobanRpc.Api.GetTransactionStatus.NOT_FOUND
    ) {
      return {
        status: SorobanRpc.Api.GetTransactionStatus.NOT_FOUND,
        latestLedger: 100,
        latestLedgerCloseTime: Math.floor(Date.now() / 1000),
        oldestLedger: 1,
        oldestLedgerCloseTime: Math.floor(Date.now() / 1000),
      } as SorobanRpc.Api.GetMissingTransactionResponse;
    }

    if (
      this.opts.getTransactionStatus ===
      SorobanRpc.Api.GetTransactionStatus.FAILED
    ) {
      return {
        status: SorobanRpc.Api.GetTransactionStatus.FAILED,
        hash,
        ledger: 100,
        createdAt: Math.floor(Date.now() / 1000),
        applicationOrder: 1,
        feeBump: false,
        latestLedger: 100,
        latestLedgerCloseTime: Math.floor(Date.now() / 1000),
        oldestLedger: 1,
        oldestLedgerCloseTime: Math.floor(Date.now() / 1000),
      } as unknown as SorobanRpc.Api.GetFailedTransactionResponse;
    }

    return {
      status: SorobanRpc.Api.GetTransactionStatus.SUCCESS,
      hash,
      ledger: 100,
      createdAt: Math.floor(Date.now() / 1000),
      applicationOrder: 1,
      feeBump: false,
      maxFee: 100,
      signatures: [],
      latestLedger: 100,
      latestLedgerCloseTime: Math.floor(Date.now() / 1000),
      oldestLedger: 1,
      oldestLedgerCloseTime: Math.floor(Date.now() / 1000),
    } as unknown as SorobanRpc.Api.GetSuccessfulTransactionResponse;
  }

  async simulateTransaction(
    _tx: Transaction,
  ): Promise<SorobanRpc.Api.SimulateTransactionResponse> {
    if (this.opts.simulateFails) {
      return {
        id: '0',
        latestLedger: 100,
        events: [],
        _parsed: false,
        error: 'Simulation failed',
      } as SorobanRpc.Api.SimulateTransactionErrorResponse;
    }

    return {
      id: '0',
      latestLedger: 100,
      events: [],
      _parsed: false,
      transactionData: {} as any,
      minResourceFee: '0',
      cost: {
        cpuInstructions: 0,
        memoryBytes: 0,
      },
      result: {
        auth: [],
        retval: this.opts.simulateResult,
      },
    } as unknown as SorobanRpc.Api.SimulateTransactionSuccessResponse;
  }

  async getAccount(_accountId: string): Promise<any> {
    if (this.opts.getAccountFails) {
      throw new Error('Account not found');
    }
    return {
      accountId: 'GAXES',
      sequenceNumber: '0',
      incrementSequenceNumber: () => {},
    };
  }
}
