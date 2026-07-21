import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SorobanRpc, Transaction } from '@stellar/stellar-sdk';
import { SorobanRpcClientInterface } from './soroban-rpc-client.interface';

@Injectable()
export class RealSorobanRpcClient implements SorobanRpcClientInterface {
  private readonly server: SorobanRpc.Server;

  constructor(private readonly configService: ConfigService) {
    this.server = new SorobanRpc.Server(
      this.configService.get<string>(
        'STELLAR_HORIZON_URL',
        'https://soroban-testnet.stellar.org',
      ),
      { allowHttp: true },
    );
  }

  async prepareTransaction(tx: Transaction): Promise<Transaction> {
    return this.server.prepareTransaction(tx);
  }

  async sendTransaction(
    tx: Transaction,
  ): Promise<SorobanRpc.Api.SendTransactionResponse> {
    return this.server.sendTransaction(tx);
  }

  async getTransaction(
    hash: string,
  ): Promise<SorobanRpc.Api.GetTransactionResponse> {
    return this.server.getTransaction(hash);
  }

  async simulateTransaction(
    tx: Transaction,
  ): Promise<SorobanRpc.Api.SimulateTransactionResponse> {
    return this.server.simulateTransaction(tx);
  }

  async getAccount(accountId: string): Promise<any> {
    return this.server.getAccount(accountId);
  }
}
