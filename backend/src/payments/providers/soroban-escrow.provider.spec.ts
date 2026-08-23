/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadGatewayException } from '@nestjs/common';
import {
  SorobanRpc,
  Keypair,
  StrKey,
  Transaction,
  xdr,
} from '@stellar/stellar-sdk';
import { SorobanEscrowProvider } from './soroban-escrow.provider';
import { FakeSorobanRpcClient } from './fake-soroban-rpc.client';
import { SOROBAN_RPC_CLIENT } from './soroban-rpc-client.interface';

const SECRET_KEY = Keypair.random().secret();
const PLATFORM = Keypair.fromSecret(SECRET_KEY).publicKey();
const CONTRACT_ID = 'ab'.repeat(32);
const BENEFICIARY = Keypair.random().publicKey();
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

interface DecodedInvocation {
  functionName: string;
  args: xdr.ScVal[];
  authCount: number;
}

/**
 * Decodes the first operation of a sent transaction back into its
 * contract-function name, argument list and authorization-entry count,
 * so every ABI assertion below runs against real XDR rather than
 * mocks (issue #227).
 */
function decodeInvocation(tx: Transaction): DecodedInvocation {
  // stellar-sdk exposes built operations as plain
  // { type, func, auth } objects.
  const op = tx.operations[0] as unknown as {
    type: string;
    func: xdr.HostFunction;
    auth: xdr.SorobanAuthorizationEntry[];
  };

  if (op.type !== 'invokeHostFunction') {
    throw new Error(`Unexpected operation: ${op.type}`);
  }
  const invokeArgs = op.func.invokeContract();

  return {
    functionName: invokeArgs.functionName().toString(),
    args: invokeArgs.args(),
    authCount: op.auth.length,
  };
}

/** Decodes an scvI128 ScVal into its BigInt value. */
function i128Value(scVal: xdr.ScVal): bigint {
  const parts = scVal.i128();
  return (BigInt(parts.hi().toString()) << 64n) | BigInt(parts.lo().toString());
}

/** Decodes an scvU64 ScVal into its BigInt value. */
function u64Value(scVal: xdr.ScVal): bigint {
  return BigInt(scVal.u64().toString());
}

/** Decodes an scvAddress(account) ScVal into its G… string. */
function accountArg(scVal: xdr.ScVal): string {
  expect(scVal.switch().name).toBe('scvAddress');
  return StrKey.encodeEd25519PublicKey(
    scVal.address().accountId().value() as Buffer,
  );
}

type ConfigOverrides = Record<string, string | undefined>;

function buildConfigService(overrides: ConfigOverrides = {}): ConfigService {
  const config: Record<string, string> = {
    STELLAR_ESCROW_CONTRACT_ID: CONTRACT_ID,
    STELLAR_BENEFICIARY_ADDRESS: BENEFICIARY,
    STELLAR_NETWORK: 'TESTNET',
    STELLAR_SECRET_KEY: SECRET_KEY,
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => config[key]),
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

describe('SorobanEscrowProvider (issue #227 — payment_escrow ABI)', () => {
  let provider: SorobanEscrowProvider;
  let fakeRpc: FakeSorobanRpcClient;

  beforeEach(async () => {
    fakeRpc = new FakeSorobanRpcClient({
      transactionHash: 'bb'.repeat(32),
    });
    provider = await createProvider(buildConfigService(), fakeRpc);
  });

  describe('createEscrow invokes the real contract ABI', () => {
    let decoded: DecodedInvocation;

    beforeEach(async () => {
      await provider.createEscrow(
        'booking-1',
        1000,
        'Test booking',
        Math.floor(Date.now() / 1000) + 3600,
      );
      expect(fakeRpc.sentTransactions).toHaveLength(1);
      decoded = decodeInvocation(fakeRpc.sentTransactions[0]);
    });

    it('calls create_escrow with the contract argument order', () => {
      // contracts/payment_escrow/src/lib.rs:174 —
      // create_escrow(depositor, escrow_id, beneficiary, amount,
      //               description, release_after)
      expect(decoded.functionName).toBe('create_escrow');
      expect(decoded.args).toHaveLength(6);

      expect(accountArg(decoded.args[0])).toBe(PLATFORM);
      expect(decoded.args[1].str()).toBe('booking-1');
      expect(accountArg(decoded.args[2])).toBe(BENEFICIARY);
    });

    it('encodes amount as i128 and release_after as u64', () => {
      expect(decoded.args[3].switch().name).toBe('scvI128');
      expect(i128Value(decoded.args[3])).toBe(1000n);
      expect(decoded.args[4].str()).toBe('Test booking');
      expect(decoded.args[5].switch().name).toBe('scvU64');
      expect(u64Value(decoded.args[5]) > 0n).toBe(true);
    });

    it('authorizes the depositor transfer via a source-account entry', () => {
      // depositor.require_auth() — the platform signs as depositor.
      expect(decoded.authCount).toBe(1);
    });

    it('returns the settled transaction hash', async () => {
      const hash = await provider.createEscrow(
        'booking-hash',
        1,
        'hash check',
        Math.floor(Date.now() / 1000) + 60,
      );
      expect(hash).toBe('bb'.repeat(32));
    });

    it('rejects non-positive or fractional amounts before touching the network', async () => {
      const sentBefore = fakeRpc.sentTransactions.length;
      await expect(provider.createEscrow('b', 0, 'x', 1)).rejects.toThrow(
        BadGatewayException,
      );
      await expect(provider.createEscrow('b', 10.5, 'x', 1)).rejects.toThrow(
        BadGatewayException,
      );
      expect(fakeRpc.sentTransactions).toHaveLength(sentBefore);
    });
  });

  describe('releaseEscrow and refundEscrow pass the caller argument', () => {
    it('release(caller, escrow_id) carries both arguments plus admin auth', async () => {
      await provider.releaseEscrow('escrow-1');

      const decoded = decodeInvocation(fakeRpc.sentTransactions[0]);
      expect(decoded.functionName).toBe('release');
      expect(decoded.args).toHaveLength(2);
      expect(accountArg(decoded.args[0])).toBe(PLATFORM);
      expect(decoded.args[1].str()).toBe('escrow-1');
      expect(decoded.authCount).toBe(1);
    });

    it('refund(caller, escrow_id) carries both arguments plus admin auth', async () => {
      await provider.refundEscrow('escrow-2');

      const decoded = decodeInvocation(fakeRpc.sentTransactions[0]);
      expect(decoded.functionName).toBe('refund');
      expect(decoded.args).toHaveLength(2);
      expect(accountArg(decoded.args[0])).toBe(PLATFORM);
      expect(decoded.args[1].str()).toBe('escrow-2');
      expect(decoded.authCount).toBe(1);
    });

    it('surfaces settlement failure as BadGatewayException', async () => {
      const failProvider = await createProvider(
        buildConfigService(),
        new FakeSorobanRpcClient({
          transactionHash: 'cc'.repeat(32),
          getTransactionStatus: SorobanRpc.Api.GetTransactionStatus.FAILED,
        }),
      );

      await expect(failProvider.releaseEscrow('escrow-fail')).rejects.toThrow(
        BadGatewayException,
      );
    });
  });

  describe('getEscrowStatus keeps matching the zero-auth read', () => {
    it('invokes get_escrow(escrow_id) without authorization entries', async () => {
      const rpc = new FakeSorobanRpcClient({ simulateResult: {} });
      const readProvider = await createProvider(buildConfigService(), rpc);

      await readProvider.getEscrowStatus('escrow-x').catch(() => undefined);

      // Read-only calls are simulated, never submitted.
      expect(rpc.sentTransactions).toHaveLength(0);
      expect(rpc.simulatedTransactions).toHaveLength(1);
      const decoded = decodeInvocation(rpc.simulatedTransactions[0]);
      expect(decoded.functionName).toBe('get_escrow');
      expect(decoded.args).toHaveLength(1);
      expect(decoded.args[0].str()).toBe('escrow-x');
      expect(decoded.authCount).toBe(0);
    });

    it('throws BadGatewayException when simulation fails', async () => {
      const failProvider = await createProvider(
        buildConfigService(),
        new FakeSorobanRpcClient({ simulateFails: true }),
      );
      await expect(failProvider.getEscrowStatus('escrow-x')).rejects.toThrow(
        BadGatewayException,
      );
    });
  });

  describe('configuration validation at boot (#227)', () => {
    it('accepts a full passphrase as STELLAR_NETWORK', async () => {
      const p = await createProvider(
        buildConfigService({ STELLAR_NETWORK: NETWORK_PASSPHRASE }),
        fakeRpc,
      );
      await expect(p.releaseEscrow('e')).resolves.toBe('bb'.repeat(32));
    });

    it.each([
      [
        'partial configuration (missing beneficiary)',
        { STELLAR_BENEFICIARY_ADDRESS: undefined },
      ],
      ['non-hex contract id', { STELLAR_ESCROW_CONTRACT_ID: 'zz' }],
      [
        'placeholder beneficiary address',
        { STELLAR_BENEFICIARY_ADDRESS: 'GBENEFIT_PLACEHOLDER' },
      ],
      ['unknown network', { STELLAR_NETWORK: 'SIDECAR' }],
      ['malformed secret key', { STELLAR_SECRET_KEY: 'not-a-secret' }],
    ])('boot fails fast on %s', async (_label, overrides) => {
      await expect(
        Test.createTestingModule({
          providers: [
            SorobanEscrowProvider,
            {
              provide: ConfigService,
              useValue: buildConfigService(overrides),
            },
            { provide: SOROBAN_RPC_CLIENT, useValue: fakeRpc },
          ],
        }).compile(),
      ).rejects.toThrow(/Invalid Soroban escrow configuration/u);
    });

    it('stays disabled (constructible, calls fail fast) when nothing is configured', async () => {
      const disabled = await createProvider(
        buildConfigService({
          STELLAR_ESCROW_CONTRACT_ID: undefined,
          STELLAR_BENEFICIARY_ADDRESS: undefined,
          STELLAR_NETWORK: undefined,
          STELLAR_SECRET_KEY: undefined,
        }),
        fakeRpc,
      );

      await expect(disabled.releaseEscrow('e')).rejects.toThrow(
        /escrow is not configured/u,
      );
      await expect(disabled.createEscrow('b', 1, 'd', 1)).rejects.toThrow(
        BadGatewayException,
      );
      expect(fakeRpc.sentTransactions).toHaveLength(0);
    });
  });

  describe('RPC interaction', () => {
    it('records sent transactions and queried hashes', async () => {
      const hash = await provider.releaseEscrow('escrow-record');
      expect(fakeRpc.sentTransactions).toHaveLength(1);
      expect(fakeRpc.queriedHashes).toContain('bb'.repeat(32));
      expect(hash).toBe('bb'.repeat(32));
    });

    it('throws when getAccount fails', async () => {
      const badAccountRpc = new FakeSorobanRpcClient({
        getAccountFails: true,
      });
      const failProvider = await createProvider(
        buildConfigService(),
        badAccountRpc,
      );

      await expect(
        failProvider.releaseEscrow('escrow-account-fail'),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
