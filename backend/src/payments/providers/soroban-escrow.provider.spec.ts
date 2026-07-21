/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadGatewayException } from '@nestjs/common';
import { SorobanRpc, Keypair } from '@stellar/stellar-sdk';
import { SorobanEscrowProvider } from './soroban-escrow.provider';
import { FakeSorobanRpcClient } from './fake-soroban-rpc.client';
import { SOROBAN_RPC_CLIENT } from './soroban-rpc-client.interface';

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({
        sign: jest.fn(),
        toXDR: jest.fn().mockReturnValue('mock-xdr'),
      }),
    })),
    Operation: {
      invokeHostFunction: jest.fn().mockReturnValue('mock-operation'),
    },
    xdr: {
      HostFunction: {
        fromXDR: jest.fn().mockReturnValue('mock-host-function'),
      },
      SorobanAuthorizationEntry: jest.fn().mockImplementation(() => ({})),
      SorobanCredentials: {
        sorobanCredentialsSourceAccount: jest.fn(),
      },
      SorobanAuthorizedInvocation: jest.fn().mockImplementation(() => ({})),
      SorobanAuthorizedFunction: {
        sorobanAuthorizedFunctionTypeContractFn: jest.fn(),
      },
      InvokeContractArgs: jest.fn().mockImplementation(() => ({})),
      ScAddress: {
        scAddressTypeContract: jest
          .fn()
          .mockReturnValue(Buffer.from('aa', 'hex')),
        scAddressTypeAccount: jest
          .fn()
          .mockReturnValue(Buffer.from('bb', 'hex')),
      },
      PublicKey: {
        publicKeyTypeEd25519: jest
          .fn()
          .mockReturnValue(Buffer.from('cc', 'hex')),
      },
      ScVal: {
        scvAddress: jest.fn().mockReturnValue('mock-address'),
        scvU128: jest.fn().mockReturnValue('mock-amount'),
      },
      UInt128Parts: jest.fn().mockImplementation(() => ({})),
      Uint64: {
        fromString: jest.fn().mockReturnValue('0'),
      },
    },
  };
});

const SECRET_KEY = Keypair.random().secret();
const CONTRACT_ID = 'a'.repeat(64);
const NETWORK = 'Test SDF Network ; September 2015';

function buildConfigService(): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        STELLAR_ESCROW_CONTRACT_ID: CONTRACT_ID,
        STELLAR_NETWORK: NETWORK,
        STELLAR_SECRET_KEY: SECRET_KEY,
      };
      return config[key] ?? defaultValue;
    }),
  } as unknown as ConfigService;
}

async function createProvider(
  configService: ConfigService,
  rpcClient: FakeSorobanRpcClient,
): Promise<SorobanEscrowProvider> {
  const module$ = await Test.createTestingModule({
    providers: [
      SorobanEscrowProvider,
      { provide: ConfigService, useValue: configService },
      { provide: SOROBAN_RPC_CLIENT, useValue: rpcClient },
    ],
  }).compile();
  return module$.get(SorobanEscrowProvider);
}

describe('SorobanEscrowProvider', () => {
  let provider: SorobanEscrowProvider;
  let fakeRpc: FakeSorobanRpcClient;
  let configService: ConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeRpc = new FakeSorobanRpcClient({
      transactionHash: 'bb'.repeat(32),
    });
    configService = buildConfigService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SorobanEscrowProvider,
        { provide: ConfigService, useValue: configService },
        { provide: SOROBAN_RPC_CLIENT, useValue: fakeRpc },
      ],
    }).compile();

    provider = module.get<SorobanEscrowProvider>(SorobanEscrowProvider);
  });

  describe('createEscrow', () => {
    it('should return the transaction hash on success', async () => {
      const depositor = Keypair.random().publicKey();
      const beneficiary = Keypair.random().publicKey();

      const hash = await provider.createEscrow(
        'booking-1',
        depositor,
        beneficiary,
        1000,
        'Test booking',
        Math.floor(Date.now() / 1000) + 3600,
      );

      expect(hash).toBe('bb'.repeat(32));
      expect(fakeRpc.sentTransactions).toHaveLength(1);
      expect(fakeRpc.queriedHashes.length).toBeGreaterThanOrEqual(1);
    });

    it('should throw BadGatewayException when transaction status is FAILED', async () => {
      const failRpc = new FakeSorobanRpcClient({
        transactionHash: 'cc'.repeat(32),
        getTransactionStatus: SorobanRpc.Api.GetTransactionStatus.FAILED,
      });

      const failProvider = await createProvider(configService, failRpc);
      const depositor = Keypair.random().publicKey();
      const beneficiary = Keypair.random().publicKey();

      jest.useFakeTimers();
      const promise = failProvider.createEscrow(
        'booking-2',
        depositor,
        beneficiary,
        500,
        'Failing booking',
        Math.floor(Date.now() / 1000) + 3600,
      );

      const rejection = expect(promise).rejects.toThrow(BadGatewayException);
      await jest.advanceTimersByTimeAsync(60_000);
      await rejection;
      jest.useRealTimers();
    });
  });

  describe('releaseEscrow', () => {
    it('should return the transaction hash on success', async () => {
      const hash = await provider.releaseEscrow('escrow-1');
      expect(hash).toBe('bb'.repeat(32));
      expect(fakeRpc.sentTransactions).toHaveLength(1);
    });

    it('should throw BadGatewayException when release status is FAILED', async () => {
      const failRpc = new FakeSorobanRpcClient({
        transactionHash: 'dd'.repeat(32),
        getTransactionStatus: SorobanRpc.Api.GetTransactionStatus.FAILED,
      });

      const failProvider = await createProvider(configService, failRpc);

      jest.useFakeTimers();
      const promise = failProvider.releaseEscrow('escrow-2');
      const rejection = expect(promise).rejects.toThrow(BadGatewayException);
      await jest.advanceTimersByTimeAsync(60_000);
      await rejection;
      jest.useRealTimers();
    });
  });

  describe('refundEscrow', () => {
    it('should return the transaction hash on success', async () => {
      const hash = await provider.refundEscrow('escrow-1');
      expect(hash).toBe('bb'.repeat(32));
      expect(fakeRpc.sentTransactions).toHaveLength(1);
    });

    it('should throw BadGatewayException when refund status is FAILED', async () => {
      const failRpc = new FakeSorobanRpcClient({
        transactionHash: 'ee'.repeat(32),
        getTransactionStatus: SorobanRpc.Api.GetTransactionStatus.FAILED,
      });

      const failProvider = await createProvider(configService, failRpc);

      jest.useFakeTimers();
      const promise = failProvider.refundEscrow('escrow-3');
      const rejection = expect(promise).rejects.toThrow(BadGatewayException);
      await jest.advanceTimersByTimeAsync(60_000);
      await rejection;
      jest.useRealTimers();
    });
  });

  describe('getEscrowStatus', () => {
    it('should throw BadGatewayException when simulation fails', async () => {
      const failRpc = new FakeSorobanRpcClient({
        simulateFails: true,
      });

      const failProvider = await createProvider(configService, failRpc);

      await expect(failProvider.getEscrowStatus('escrow-x')).rejects.toThrow(
        BadGatewayException,
      );
    });
  });

  describe('without STELLAR_SECRET_KEY', () => {
    it('should throw BadGatewayException when signing key is missing', async () => {
      const noKeyConfig = {
        get: jest.fn((key: string, defaultValue?: string) => {
          const config: Record<string, string> = {
            STELLAR_ESCROW_CONTRACT_ID: CONTRACT_ID,
            STELLAR_NETWORK: NETWORK,
          };
          return config[key] ?? defaultValue;
        }),
      } as unknown as ConfigService;

      const noKeyProvider = await createProvider(noKeyConfig, fakeRpc);

      await expect(noKeyProvider.releaseEscrow('escrow-y')).rejects.toThrow(
        BadGatewayException,
      );
    });
  });

  describe('FakeSorobanRpcClient', () => {
    it('should record sent transactions and queried hashes', async () => {
      const hash = await provider.releaseEscrow('escrow-record');
      expect(fakeRpc.sentTransactions).toHaveLength(1);
      expect(fakeRpc.queriedHashes).toContain('bb'.repeat(32));
      expect(hash).toBe('bb'.repeat(32));
    });

    it('should throw when getAccount fails', async () => {
      const badAccountRpc = new FakeSorobanRpcClient({
        getAccountFails: true,
      });

      const failProvider = await createProvider(configService, badAccountRpc);

      await expect(
        failProvider.releaseEscrow('escrow-account-fail'),
      ).rejects.toThrow();
    });
  });
});
