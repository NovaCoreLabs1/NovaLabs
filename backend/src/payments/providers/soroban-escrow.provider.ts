import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SorobanRpc,
  Transaction,
  TransactionBuilder,
  Operation,
  Account,
  Keypair,
  StrKey,
  xdr,
} from '@stellar/stellar-sdk';
import {
  mapScValToescrow,
  mapScValToescrowStatus,
} from 'src/utils/soroban-types';
import {
  SorobanRpcClientInterface,
  SOROBAN_RPC_CLIENT,
} from './soroban-rpc-client.interface';

const TTL = 10 * 60; // 10 minutes

/** Contract functions this provider talks to (contracts/payment_escrow/src/lib.rs). */
const FN_CREATE_ESCROW = 'create_escrow';
const FN_RELEASE = 'release';
const FN_REFUND = 'refund';
const FN_GET_ESCROW = 'get_escrow';

/**
 * Accepts either a friendly alias or the exact Stellar network
 * passphrase, so operators can set `STELLAR_NETWORK=TESTNET` or paste
 * the full passphrase used by their deployment tooling.
 */
const NETWORK_PASSPHRASES: Record<string, string> = {
  TESTNET: 'Test SDF Network ; September 2015',
  PUBLIC: 'Public Global Sorrow Network ; February 2021',
  FUTURENET: 'Test SDF Future Network ; October 2022',
};

interface EscrowConfig {
  contractId: string;
  beneficiary: string;
  networkPassphrase: string;
  signingKeypair: Keypair;
}

@Injectable()
export class SorobanEscrowProvider {
  private readonly logger = new Logger(SorobanEscrowProvider.name);
  private config: EscrowConfig | null;

  constructor(
    private readonly configService: ConfigService,
    @Inject(SOROBAN_RPC_CLIENT)
    private readonly rpcClient: SorobanRpcClientInterface,
  ) {
    const contractId = this.read('STELLAR_ESCROW_CONTRACT_ID');
    const beneficiary = this.read('STELLAR_BENEFICIARY_ADDRESS');
    const network = this.read('STELLAR_NETWORK');
    const secretKey = this.read('STELLAR_SECRET_KEY');

    const anySet = [contractId, beneficiary, network, secretKey].some(
      (v) => v !== undefined && v !== '',
    );

    if (!anySet) {
      // Escrow not deployed/enabled in this environment — disable the
      // provider instead of crashing unrelated deployments. Any call
      // fails fast with an explicit error.
      this.config = null;
      this.logger.warn(
        '[Soroban] Escrow disabled: STELLAR_ESCROW_CONTRACT_ID, STELLAR_BENEFICIARY_ADDRESS, STELLAR_NETWORK and STELLAR_SECRET_KEY are all unset.',
      );
      return;
    }

    this.config = this.validate(contractId, beneficiary, network, secretKey);
    this.logger.log(
      `[Soroban] Escrow enabled (contract ${contractId}, network ${network}).`,
    );
  }

  /**
   * Creates an on-chain escrow for a booking payment.
   *
   * The platform keypair acts as the on-chain depositor: `create_escrow`
   * pulls funds from the depositor with `depositor.require_auth()`, and
   * the only signature this process can produce is its own. When
   * non-custodial member wallets are introduced, this is the seam to
   * replace (issue #227).
   *
   * @returns the hash of the settled Soroban transaction
   */
  async createEscrow(
    bookingId: string,
    amount: number,
    description: string,
    releaseAfterUnix: number,
  ): Promise<string> {
    this.assertEnabled();
    this.logger.log(
      `[Soroban] createEscrow: ${bookingId} - ${amount} from ${this.platformAddress()}`,
    );

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadGatewayException(
        'Escrow amount must be a positive integer (kobo).',
      );
    }

    const args = [
      this.accountScVal(this.platformAddress()),
      xdr.ScVal.scvString(bookingId),
      this.accountScVal(this.beneficiaryAddress()),
      xdr.ScVal.scvI128(
        new xdr.Int128Parts({
          hi: xdr.Int64.fromString('0'),
          lo: xdr.Uint64.fromString(String(amount)),
        }),
      ),
      xdr.ScVal.scvString(description),
      xdr.ScVal.scvU64(xdr.Uint64.fromString(String(releaseAfterUnix))),
    ];

    return this.submit(
      this.buildInvocation(FN_CREATE_ESCROW, args),
      `createEscrow(${bookingId})`,
    );
  }

  async releaseEscrow(escrowId: string): Promise<string> {
    this.assertEnabled();
    this.logger.log(`[Soroban] releaseEscrow: ${escrowId}`);

    return this.submit(
      this.buildInvocation(FN_RELEASE, [
        this.accountScVal(this.platformAddress()),
        xdr.ScVal.scvString(escrowId),
      ]),
      `releaseEscrow(${escrowId})`,
    );
  }

  async refundEscrow(escrowId: string): Promise<string> {
    this.assertEnabled();
    this.logger.log(`[Soroban] refundEscrow: ${escrowId}`);

    return this.submit(
      this.buildInvocation(FN_REFUND, [
        this.accountScVal(this.platformAddress()),
        xdr.ScVal.scvString(escrowId),
      ]),
      `refundEscrow(${escrowId})`,
    );
  }

  async getEscrowStatus(escrowId: string): Promise<any> {
    this.assertEnabled();
    this.logger.log(`[Soroban] getEscrowStatus: ${escrowId}`);

    const timebounds = {
      minTime: 0,
      maxTime: Math.floor(Date.now() / 1000) + TTL,
    };

    try {
      const tx = new TransactionBuilder(await this.getSourceAccount(), {
        fee: '100',
        networkPassphrase: this.escrow.networkPassphrase,
        timebounds,
      })
        .addOperation(
          this.buildInvocation(
            FN_GET_ESCROW,
            [xdr.ScVal.scvString(escrowId)],
            false,
          ),
        )
        .build();

      const preparedTransaction = await this.rpcClient.prepareTransaction(tx);
      const simulatedTransaction =
        await this.rpcClient.simulateTransaction(preparedTransaction);

      if (
        !SorobanRpc.Api.isSimulationSuccess(simulatedTransaction) ||
        !simulatedTransaction.result?.retval
      ) {
        this.logger.error(
          `[Soroban] getEscrowStatus failed for escrow ${escrowId}: Invalid simulation response`,
        );
        throw new NotFoundException('Escrow not found.');
      }

      const escrow = mapScValToescrow(simulatedTransaction.result.retval);
      return {
        ...escrow,
        status: mapScValToescrowStatus(escrow.status),
      };
    } catch (error) {
      this.logger.error(
        `[Soroban] getEscrowStatus failed for escrow ${escrowId}: ${error.message}`,
      );
      throw new BadGatewayException(
        'Failed to get escrow status from Soroban network.',
      );
    }
  }

  /* ── Invocation plumbing ──────────────────────────────────────────── */

  /**
   * Builds a typed `invoke_contract` host function for
   * contracts/payment_escrow. Functions carrying `require_auth`
   * (`create_escrow` depositor, `release`/`refund` admin caller) get a
   * source-account authorization entry whose root invocation mirrors
   * the call exactly, satisfied by the platform signature.
   */
  private buildInvocation(
    functionName: string,
    args: xdr.ScVal[],
    withAuth = true,
  ): xdr.Operation<Operation.InvokeHostFunction> {
    const invokeArgs = new xdr.InvokeContractArgs({
      contractAddress: xdr.ScAddress.scAddressTypeContract(
        Buffer.from(this.escrow.contractId, 'hex'),
      ),
      functionName,
      args,
    });

    const auth = withAuth
      ? [
          new xdr.SorobanAuthorizationEntry({
            credentials:
              xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
            rootInvocation: new xdr.SorobanAuthorizedInvocation({
              function:
                xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
                  invokeArgs,
                ),
              subInvocations: [],
            }),
          }),
        ]
      : [];

    return Operation.invokeHostFunction({
      func: xdr.HostFunction.hostFunctionTypeInvokeContract(invokeArgs),
      auth,
    });
  }

  /** Prepares, signs, submits and polls one escrow invocation to settlement. */
  private async submit(
    operation: xdr.Operation<Operation.InvokeHostFunction>,
    label: string,
  ): Promise<string> {
    const timebounds = {
      minTime: 0,
      maxTime: Math.floor(Date.now() / 1000) + TTL,
    };

    try {
      const tx = new TransactionBuilder(await this.getSourceAccount(), {
        fee: '100',
        networkPassphrase: this.escrow.networkPassphrase,
        timebounds,
      })
        .addOperation(operation)
        .build();

      const preparedTransaction = await this.rpcClient.prepareTransaction(tx);
      preparedTransaction.sign(this.signingKeypair());

      const sentTransaction =
        await this.rpcClient.sendTransaction(preparedTransaction);
      const settled = await this.waitForSettlement(sentTransaction.hash);

      if (settled.status !== SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        throw new Error(
          `Transaction ${sentTransaction.hash} settled with status ${settled.status}`,
        );
      }

      return sentTransaction.hash;
    } catch (error) {
      this.logger.error(`[Soroban] ${label} failed: ${error.message}`);
      throw new BadGatewayException(
        `Failed to execute Soroban transaction (${label}).`,
      );
    }
  }

  /** Polls the RPC client until the transaction leaves NOT_FOUND or the 30s budget lapses. */
  private async waitForSettlement(
    hash: string,
  ): Promise<SorobanRpc.Api.GetTransactionResponse> {
    let response = await this.rpcClient.getTransaction(hash);

    const thirtySeconds = 30 * 1000;
    const startTime = Date.now();
    while (
      response.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND &&
      Date.now() - startTime < thirtySeconds
    ) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // eslint-disable-next-line no-await-in-loop
      response = await this.rpcClient.getTransaction(hash);
    }
    return response;
  }

  /* ── Configuration ────────────────────────────────────────────────── */

  /**
   * Fail-fast validation mirroring resolveCorsConfig: when any
   * STELLAR_* variable is present, all four must be present and well
   * formed, otherwise boot aborts instead of shipping an escrow path
   * that can only fail at payment time.
   */
  private validate(
    contractId?: string,
    beneficiary?: string,
    network?: string,
    secretKey?: string,
  ): EscrowConfig {
    const problems: string[] = [];

    if (!contractId) problems.push('STELLAR_ESCROW_CONTRACT_ID is required');
    else if (!/^[0-9a-fA-F]{64}$/.test(contractId))
      problems.push(
        'STELLAR_ESCROW_CONTRACT_ID must be a 64-char hex contract ID',
      );

    if (!beneficiary) problems.push('STELLAR_BENEFICIARY_ADDRESS is required');
    else if (!StrKey.isValidEd25519PublicKey(beneficiary))
      problems.push(
        'STELLAR_BENEFICIARY_ADDRESS must be a valid Stellar account (G…) address',
      );

    if (!network) problems.push('STELLAR_NETWORK is required');
    else if (
      !(network in NETWORK_PASSPHRASES) &&
      !Object.values(NETWORK_PASSPHRASES).includes(network)
    )
      problems.push(
        `STELLAR_NETWORK must be one of ${Object.keys(NETWORK_PASSPHRASES).join(', ')} or a known passphrase`,
      );

    let keypair: Keypair | null = null;
    if (!secretKey) problems.push('STELLAR_SECRET_KEY is required');
    else {
      try {
        keypair = Keypair.fromSecret(secretKey);
      } catch {
        problems.push(
          'STELLAR_SECRET_KEY is not a valid Stellar secret key (S…)',
        );
      }
    }

    if (problems.length > 0) {
      throw new Error(
        `Invalid Soroban escrow configuration: ${problems.join('; ')}`,
      );
    }

    const passphrase = NETWORK_PASSPHRASES[network]
      ? NETWORK_PASSPHRASES[network]
      : network;

    return {
      contractId: contractId.toLowerCase(),
      beneficiary,
      networkPassphrase: passphrase,
      signingKeypair: keypair,
    };
  }

  private read(key: string): string | undefined {
    return this.configService.get<string>(key);
  }

  /* ── Small helpers ────────────────────────────────────────────────── */

  private assertEnabled(): void {
    if (!this.config) {
      throw new BadGatewayException(
        'Soroban escrow is not configured (STELLAR_* variables missing).',
      );
    }
  }

  /** Validated configuration; throws if escrow is disabled. */
  private get escrow(): EscrowConfig {
    if (!this.config) {
      throw new BadGatewayException(
        'Soroban escrow is not configured (STELLAR_* variables missing).',
      );
    }
    return this.config;
  }

  private platformAddress(): string {
    return this.signingKeypair().publicKey();
  }

  private beneficiaryAddress(): string {
    return this.escrow.beneficiary;
  }

  private accountScVal(publicKey: string): xdr.ScVal {
    return xdr.ScVal.scvAddress(
      xdr.ScAddress.scAddressTypeAccount(
        xdr.PublicKey.publicKeyTypeEd25519(
          Keypair.fromPublicKey(publicKey).rawPublicKey(),
        ),
      ),
    );
  }

  private signingKeypair(): Keypair {
    if (!this.config) {
      throw new BadGatewayException(
        'Soroban signing key is not configured (STELLAR_SECRET_KEY missing).',
      );
    }
    return this.escrow.signingKeypair;
  }

  private async getSourceAccount(): Promise<Account> {
    return await this.rpcClient.getAccount(this.platformAddress());
  }
}
