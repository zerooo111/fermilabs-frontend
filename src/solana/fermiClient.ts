import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  createCloseAccountInstruction,
  createInitializeAccount3Instruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  type AccountInfo,
  type AccountMeta,
  type Commitment,
  ComputeBudgetProgram,
  type Connection,
  Keypair,
  PublicKey,
  type Signer,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
  type TransactionSignature,
} from '@solana/web3.js';

import {
  type AnchorProvider,
  BN,
  type IdlAccounts,
  type IdlTypes,
  Program,
} from '@coral-xyz/anchor';
import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';

import { Side } from './constants';
import { type FermiDex, IDL } from './idl';
import { checkOrCreateAssociatedTokenAccount } from './utils/helpers';
import { sendTransaction } from './utils/rpc';

export type IdsSource = 'api' | 'static' | 'get-program-accounts';
export type PlaceOrderArgs = IdlTypes<FermiDex>['PlaceOrderArgs'];
export type PlaceOrderPeggedArgs = IdlTypes<FermiDex>['PlaceOrderPeggedArgs'];
export type OracleConfigParams = IdlTypes<FermiDex>['OracleConfigParams'];
export type OracleConfig = IdlTypes<FermiDex>['OracleConfig'];
export type MarketAccount = IdlAccounts<FermiDex>['market'];
export type OpenOrdersAccount = IdlAccounts<FermiDex>['openOrdersAccount'];
export type OpenOrdersIndexerAccount = IdlAccounts<FermiDex>['openOrdersIndexer'];
export type EventHeapAccount = IdlAccounts<FermiDex>['eventHeap'];
export type BookSideAccount = IdlAccounts<FermiDex>['bookSide'];
export type LeafNode = IdlTypes<FermiDex>['LeafNode'];
export type AnyNode = IdlTypes<FermiDex>['AnyNode'];
export type FillEvent = IdlTypes<FermiDex>['FillEvent'];
export type OutEvent = IdlTypes<FermiDex>['OutEvent'];

export interface OpenBookClientOptions {
  idsSource?: IdsSource;
  postSendTxCallback?: ({ txid }: { txid: string }) => void;
  prioritizationFee?: number;
  txConfirmationCommitment?: Commitment;
}

export function nameToString(name: number[]): string {
  return utf8.decode(new Uint8Array(name)).split('\x00')[0];
}

const BooksideSpace = 90944 + 8;
const EventHeapSpace = 91280 + 8;

export class FermiClient {
  public program: Program<FermiDex>;

  private readonly postSendTxCallback?: ({ txid }: any) => void;
  private readonly prioritizationFee: number;
  private readonly txConfirmationCommitment: Commitment;

  constructor(
    public provider: AnchorProvider,
    public programId: PublicKey,
    public opts: OpenBookClientOptions = {}
  ) {
    this.program = new Program<FermiDex>(IDL, programId, provider);
    this.prioritizationFee = opts?.prioritizationFee ?? 0;
    this.postSendTxCallback = opts?.postSendTxCallback;
    this.txConfirmationCommitment =
      opts?.txConfirmationCommitment ??
      ((this.program.provider as AnchorProvider).opts !== undefined
        ? (this.program.provider as AnchorProvider).opts.commitment
        : undefined) ??
      'processed';
    // TODO: evil side effect, but limited backtraces are a nightmare
    Error.stackTraceLimit = 1000;
  }

  /// Convenience accessors
  public get connection(): Connection {
    return this.program.provider.connection;
  }

  public get walletPk(): PublicKey {
    return (this.program.provider as AnchorProvider).wallet.publicKey;
  }

  public setProvider(provider: AnchorProvider): void {
    this.program = new Program<FermiDex>(IDL, this.programId, provider);
  }

  /// Transactions
  public async sendAndConfirmTransaction(
    ixs: TransactionInstruction[],
    opts: any = {}
  ): Promise<string> {
    return await sendTransaction(this.program.provider as AnchorProvider, ixs, opts.alts ?? [], {
      postSendTxCallback: this.postSendTxCallback,
      prioritizationFee: this.prioritizationFee,
      txConfirmationCommitment: this.txConfirmationCommitment,
      ...opts,
    });
  }

  public async createProgramAccount(authority: Keypair, size: number): Promise<PublicKey> {
    const lamports = await this.connection.getMinimumBalanceForRentExemption(size);
    const address = Keypair.generate();

    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: address.publicKey,
        lamports,
        space: size,
        programId: this.programId,
      })
    ).instructions;

    await this.sendAndConfirmTransaction(tx, {
      additionalSigners: [authority, address],
    });
    return address.publicKey;
  }

  public async createProgramAccountIx(
    authority: PublicKey,
    size: number
  ): Promise<[TransactionInstruction, Signer]> {
    const lamports = await this.connection.getMinimumBalanceForRentExemption(size);
    const address = Keypair.generate();

    const ix = SystemProgram.createAccount({
      fromPubkey: authority,
      newAccountPubkey: address.publicKey,
      lamports,
      space: size,
      programId: this.programId,
    });
    return [ix, address];
  }

  // Get the MarketAccount from the market publicKey
  public async deserializeMarketAccount(publicKey: PublicKey): Promise<MarketAccount | null> {
    try {
      return await this.program.account.market.fetch(publicKey);
    } catch (error) {
      console.error('Error in deserializeMarketAccount:', error);
      return null;
    }
  }

  public async deserializeOpenOrderAccount(
    publicKey: PublicKey
  ): Promise<OpenOrdersAccount | null> {
    try {
      return await this.program.account.openOrdersAccount.fetch(publicKey);
    } catch {
      return null;
    }
  }

  public async deserializeOpenOrdersIndexerAccount(
    publicKey: PublicKey
  ): Promise<OpenOrdersIndexerAccount | null> {
    try {
      return await this.program.account.openOrdersIndexer.fetch(publicKey);
    } catch {
      return null;
    }
  }

  public async deserializeEventHeapAccount(publicKey: PublicKey): Promise<EventHeapAccount | null> {
    try {
      return await this.program.account.eventHeap.fetch(publicKey);
    } catch {
      return null;
    }
  }

  public async deserializeBookSide(publicKey: PublicKey): Promise<BookSideAccount | null> {
    try {
      return await this.program.account.bookSide.fetch(publicKey);
    } catch {
      return null;
    }
  }

  public priceData(key: BN): number {
    const shiftedValue = key.shrn(64); // Shift right by 64 bits
    return shiftedValue.toNumber(); // Convert BN to a regular number
  }

  // Get bids or asks from a bookside account
  public getLeafNodes(bookside: BookSideAccount): LeafNode[] {
    const leafNodesData = bookside.nodes.nodes.filter((x: AnyNode) => x.tag === 2);
    const leafNodes: LeafNode[] = [];
    for (const x of leafNodesData) {
      const leafNode: LeafNode = this.program.coder.types.decode(
        'LeafNode',
        Buffer.from([0, ...x.data])
      );
      leafNodes.push(leafNode);
    }
    return leafNodes;
  }

  public async createMarketIx(
    payer: PublicKey,
    name: string,
    quoteMint: PublicKey,
    baseMint: PublicKey,
    quoteLotSize: BN,
    baseLotSize: BN,
    makerFee: BN,
    takerFee: BN,
    timeExpiry: BN,
    oracleA: PublicKey | null,
    oracleB: PublicKey | null,
    openOrdersAdmin: PublicKey | null,
    consumeEventsAdmin: PublicKey | null,
    closeMarketAdmin: PublicKey | null,
    oracleConfigParams: OracleConfigParams = {
      confFilter: 0.1,
      maxStalenessSlots: 100,
    },
    market = Keypair.generate(),
    collectFeeAdmin?: PublicKey
  ): Promise<[TransactionInstruction[], Signer[]]> {
    const [bidIx, bidsKeypair] = await this.createProgramAccountIx(payer, BooksideSpace);
    const [askIx, askKeypair] = await this.createProgramAccountIx(payer, BooksideSpace);
    const [eventHeapIx, eventHeapKeypair] = await this.createProgramAccountIx(
      payer,
      EventHeapSpace
    );

    const [marketAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('Market'), market.publicKey.toBuffer()],
      this.program.programId
    );

    const baseVault = getAssociatedTokenAddressSync(baseMint, marketAuthority, true);

    const quoteVault = getAssociatedTokenAddressSync(quoteMint, marketAuthority, true);

    const [eventAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('__event_authority')],
      this.program.programId
    );

    const ix = await this.program.methods
      .createMarket(
        name,
        oracleConfigParams,
        quoteLotSize,
        baseLotSize,
        makerFee,
        takerFee,
        timeExpiry
      )
      .accounts({
        market: market.publicKey,
        marketAuthority,
        bids: bidsKeypair.publicKey,
        asks: askKeypair.publicKey,
        eventHeap: eventHeapKeypair.publicKey,
        payer,
        marketBaseVault: baseVault,
        marketQuoteVault: quoteVault,
        baseMint,
        quoteMint,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        oracleA,
        oracleB,
        collectFeeAdmin: collectFeeAdmin != null ? collectFeeAdmin : payer,
        openOrdersAdmin,
        consumeEventsAdmin,
        closeMarketAdmin,
        eventAuthority,
        program: this.programId,
      })
      .instruction();

    return [
      [bidIx, askIx, eventHeapIx, ix],
      [market, bidsKeypair, askKeypair, eventHeapKeypair],
    ];
  }

  // Book and EventHeap must be empty before closing a market.
  // Make sure to call consumeEvents and pruneOrders before closing the market.
  public async closeMarketIx(
    marketPublicKey: PublicKey,
    market: MarketAccount,
    solDestination: PublicKey,
    closeMarketAdmin: Keypair | null = null
  ): Promise<[TransactionInstruction, Signer[]]> {
    const ix = await this.program.methods
      .closeMarket()
      .accounts({
        closeMarketAdmin: market.closeMarketAdmin.key,
        market: marketPublicKey,
        asks: market.asks,
        bids: market.bids,
        eventHeap: market.eventHeap,
        solDestination: solDestination,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    const signers: Signer[] = [];
    if (this.walletPk !== market.closeMarketAdmin.key && closeMarketAdmin !== null) {
      signers.push(closeMarketAdmin);
    }

    return [ix, signers];
  }

  // Each owner has one open order indexer
  public findOpenOrdersIndexer(owner: PublicKey = this.walletPk): PublicKey {
    const [openOrdersIndexer] = PublicKey.findProgramAddressSync(
      [Buffer.from('OpenOrdersIndexer'), owner.toBuffer()],
      this.programId
    );
    return openOrdersIndexer;
  }

  public async createOpenOrdersIndexer(
    openOrdersIndexer: PublicKey
  ): Promise<TransactionSignature> {
    const ix = await this.program.methods
      .createOpenOrdersIndexer()
      .accounts({
        openOrdersIndexer,
        owner: this.walletPk,
        payer: this.walletPk,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    return await this.sendAndConfirmTransaction([ix]);
  }

  public async createOpenOrdersIndexerIx(
    openOrdersIndexer: PublicKey,
    owner: PublicKey = this.walletPk
  ): Promise<TransactionInstruction> {
    return await this.program.methods
      .createOpenOrdersIndexer()
      .accounts({
        openOrdersIndexer,
        owner,
        payer: this.walletPk,
      })
      .instruction();
  }

  public async findAllOpenOrders(owner: PublicKey = this.walletPk): Promise<PublicKey[]> {
    const indexer = this.findOpenOrdersIndexer(owner);
    const indexerAccount = await this.deserializeOpenOrdersIndexerAccount(indexer);
    return indexerAccount?.addresses ?? [];
  }

  public findOpenOrderAtIndex(owner: PublicKey = this.walletPk, accountIndex: BN): PublicKey {
    const [openOrders] = PublicKey.findProgramAddressSync(
      [Buffer.from('OpenOrders'), owner.toBuffer(), accountIndex.toArrayLike(Buffer, 'le', 4)],
      this.programId
    );
    return openOrders;
  }

  public async findOpenOrdersForMarket(
    owner: PublicKey = this.walletPk,
    market: PublicKey
  ): Promise<PublicKey[]> {
    const openOrdersForMarket: PublicKey[] = [];
    const allOpenOrders = await this.findAllOpenOrders(owner);

    for await (const openOrders of allOpenOrders) {
      const openOrdersAccount = await this.deserializeOpenOrderAccount(openOrders);
      if (openOrdersAccount?.market.toString() === market.toString()) {
        openOrdersForMarket.push(openOrders);
      }
    }
    return openOrdersForMarket;
  }

  public async createOpenOrdersIx(
    market: PublicKey,
    name: string,
    owner: PublicKey = this.walletPk,
    delegateAccount: PublicKey | null
  ): Promise<[TransactionInstruction[], PublicKey]> {
    const ixs: TransactionInstruction[] = [];
    let accountIndex = new BN(1);

    const openOrdersIndexer = this.findOpenOrdersIndexer(owner);

    try {
      const storedIndexer = await this.deserializeOpenOrdersIndexerAccount(openOrdersIndexer);
      if (storedIndexer == null) {
        ixs.push(await this.createOpenOrdersIndexerIx(openOrdersIndexer, owner));
      } else {
        accountIndex = new BN(storedIndexer.createdCounter + 1);
      }
    } catch {
      ixs.push(await this.createOpenOrdersIndexerIx(openOrdersIndexer, owner));
    }

    const openOrdersAccount = this.findOpenOrderAtIndex(owner, accountIndex);
    ixs.push(
      await this.program.methods
        .createOpenOrdersAccount(name)
        .accounts({
          openOrdersIndexer,
          openOrdersAccount,
          market,
          owner,
          delegateAccount,
          payer: this.walletPk,
          // systemProgram: SystemProgram.programId,
        })
        .instruction()
    );

    return [ixs, openOrdersAccount];
  }

  public async createOpenOrders(
    payer: Keypair,
    market: PublicKey,
    name: string,
    owner: Keypair = payer,
    delegateAccount: PublicKey | null = null
  ): Promise<PublicKey> {
    const [ixs, openOrdersAccount] = await this.createOpenOrdersIx(
      market,
      name,
      owner.publicKey,
      delegateAccount
    );
    const additionalSigners = [payer];
    if (owner !== payer) {
      additionalSigners.push(owner);
    }

    await this.sendAndConfirmTransaction(ixs, {
      additionalSigners,
    });

    return openOrdersAccount;
  }
  public async depositIx(
    openOrdersPublicKey: PublicKey,
    openOrdersAccount: OpenOrdersAccount,
    market: MarketAccount,
    userBaseAccount: PublicKey,
    userQuoteAccount: PublicKey,
    baseAmount: BN,
    quoteAmount: BN
  ): Promise<TransactionInstruction> {
    const ix = await this.program.methods
      .deposit(baseAmount, quoteAmount)
      .accounts({
        owner: openOrdersAccount.owner,
        market: openOrdersAccount.market,
        openOrdersAccount: openOrdersPublicKey,
        userBaseAccount,
        userQuoteAccount,
        marketBaseVault: market.marketBaseVault,
        marketQuoteVault: market.marketQuoteVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    return ix;
  }

  public async depositNativeIx(
    openOrdersPublicKey: PublicKey,
    openOrdersAccount: OpenOrdersAccount,
    market: MarketAccount,
    userBaseAccount: PublicKey,
    userQuoteAccount: PublicKey,
    baseAmount: BN,
    quoteAmount: BN
  ): Promise<[TransactionInstruction[], Signer[]]> {
    const wrappedSolAccount: Keypair | undefined = new Keypair();
    let preInstructions: TransactionInstruction[] = [];
    let postInstructions: TransactionInstruction[] = [];
    const additionalSigners: Signer[] = [];

    const lamports = baseAmount.add(new BN(1e7));

    preInstructions = [
      SystemProgram.createAccount({
        fromPubkey: openOrdersAccount.owner,
        newAccountPubkey: wrappedSolAccount.publicKey,
        lamports: lamports.toNumber(),
        space: 165,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeAccount3Instruction(
        wrappedSolAccount.publicKey,
        NATIVE_MINT,
        openOrdersAccount.owner
      ),
    ];
    postInstructions = [
      createCloseAccountInstruction(
        wrappedSolAccount.publicKey,
        openOrdersAccount.owner,
        openOrdersAccount.owner
      ),
    ];
    additionalSigners.push(wrappedSolAccount);

    const ix = await this.program.methods
      .deposit(baseAmount, quoteAmount)
      .accounts({
        owner: openOrdersAccount.owner,
        market: openOrdersAccount.market,
        openOrdersAccount: openOrdersPublicKey,
        userBaseAccount,
        userQuoteAccount,
        marketBaseVault: market.marketBaseVault,
        marketQuoteVault: market.marketBaseVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    return [[...preInstructions, ix, ...postInstructions], additionalSigners];
  }

  public decodeMarket(data: Buffer): any {
    return this.program.coder.accounts.decode('Market', data);
  }

  public async new_order_and_finalize(
    market: PublicKey,
    marketAuthority: PublicKey,
    eventHeap: PublicKey,
    bids: PublicKey,
    asks: PublicKey,
    takerBaseAccount: PublicKey,
    takerQuoteAccount: PublicKey,
    makerBaseAccount: PublicKey,
    makerQuoteAccount: PublicKey,
    marketVaultQuote: PublicKey,
    marketVaultBase: PublicKey,
    maker: PublicKey,
    taker: PublicKey,
    limit: BN,
    orderid: BN,
    qty: BN,
    side: PlaceOrderArgs['side']
  ): Promise<[TransactionInstruction, Signer[]]> {
    // Create the additional compute budget instructions
    const computeUnitLimitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
      units: 800000,
    });

    // Create the main instruction with the required accounts
    const signer = this.walletPk;
    const mainInstruction = await this.program.methods
      .placeAndFinalize(limit, orderid, qty, side)
      .accounts({
        signer,
        market,
        marketAuthority,
        eventHeap,
        bids,
        asks,
        takerBaseAccount,
        takerQuoteAccount,
        makerBaseAccount,
        makerQuoteAccount,
        marketVaultQuote,
        marketVaultBase,
        maker,
        taker,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    // Initialize the instructions array
    const instructions: TransactionInstruction[] = [mainInstruction];

    // Prepend the compute budget instruction
    instructions.unshift(computeUnitLimitInstruction);

    const signers: Signer[] = [];

    return [mainInstruction, signers];
  }

  public async placeOrderIx(
    openOrdersPublicKey: PublicKey,
    marketPublicKey: PublicKey,
    market: MarketAccount,
    userTokenAccount: PublicKey,
    openOrdersAdmin: PublicKey | null,
    args: PlaceOrderArgs,
    remainingAccounts: PublicKey[],
    openOrdersDelegate?: Keypair
  ): Promise<[TransactionInstruction, Signer[]]> {
    console.log({ args });
    const marketVault = args.side === Side.Bid ? market.marketQuoteVault : market.marketBaseVault;
    const accountsMeta: AccountMeta[] = remainingAccounts.map(remaining => ({
      pubkey: remaining,
      isSigner: false,
      isWritable: true,
    }));

    const ix = await this.program.methods
      .placeOrder(args)
      .accounts({
        signer: openOrdersDelegate != null ? openOrdersDelegate.publicKey : this.walletPk,
        asks: market.asks,
        bids: market.bids,
        marketVault,
        eventHeap: market.eventHeap,
        market: marketPublicKey,
        marketAuthority: market.marketAuthority,
        openOrdersAccount: openOrdersPublicKey,
        oracleA: market.oracleA.key,
        oracleB: market.oracleB.key,
        userTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        openOrdersAdmin,
      })
      .remainingAccounts(accountsMeta)
      .instruction();
    const signers: Signer[] = [];
    if (openOrdersDelegate != null) {
      signers.push(openOrdersDelegate);
    }
    return [ix, signers];
  }

  public async placeOrderPeggedIx(
    openOrdersPublicKey: PublicKey,
    marketPublicKey: PublicKey,
    market: MarketAccount,
    userTokenAccount: PublicKey,
    openOrdersAdmin: PublicKey | null,
    args: PlaceOrderPeggedArgs,
    remainingAccounts: PublicKey[],
    openOrdersDelegate?: Keypair
  ): Promise<[TransactionInstruction, Signer[]]> {
    const marketVault = args.side === Side.Bid ? market.marketQuoteVault : market.marketBaseVault;
    const accountsMeta: AccountMeta[] = remainingAccounts.map(remaining => ({
      pubkey: remaining,
      isSigner: false,
      isWritable: true,
    }));

    const ix = await this.program.methods
      .placeOrderPegged(args)
      .accounts({
        signer: openOrdersDelegate != null ? openOrdersDelegate.publicKey : this.walletPk,
        asks: market.asks,
        bids: market.bids,
        marketVault,
        eventHeap: market.eventHeap,
        market: marketPublicKey,
        openOrdersAccount: openOrdersPublicKey,
        oracleA: market.oracleA.key,
        oracleB: market.oracleB.key,
        userTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        openOrdersAdmin,
      })
      .remainingAccounts(accountsMeta)
      .instruction();
    const signers: Signer[] = [];
    if (openOrdersDelegate != null) {
      signers.push(openOrdersDelegate);
    }
    return [ix, signers];
  }

  public async placeTakeOrderIx(
    marketPublicKey: PublicKey,
    market: MarketAccount,
    userBaseAccount: PublicKey,
    userQuoteAccount: PublicKey,
    openOrdersAdmin: PublicKey | null,
    args: PlaceOrderArgs,
    remainingAccounts: PublicKey[],
    referrerAccount: PublicKey | null,
    openOrdersDelegate?: Keypair
  ): Promise<[TransactionInstruction, Signer[]]> {
    const accountsMeta: AccountMeta[] = remainingAccounts.map(remaining => ({
      pubkey: remaining,
      isSigner: false,
      isWritable: true,
    }));
    const ix = await this.program.methods
      .placeTakeOrder(args)
      .accounts({
        signer: openOrdersDelegate != null ? openOrdersDelegate.publicKey : this.walletPk,
        asks: market.asks,
        bids: market.bids,
        eventHeap: market.eventHeap,
        market: marketPublicKey,
        oracleA: market.oracleA.key,
        oracleB: market.oracleB.key,
        userBaseAccount,
        userQuoteAccount,
        marketBaseVault: market.marketBaseVault,
        marketQuoteVault: market.marketQuoteVault,
        marketAuthority: market.marketAuthority,
        referrerAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        openOrdersAdmin,
      })
      .remainingAccounts(accountsMeta)
      .instruction();
    const signers: Signer[] = [];
    if (openOrdersDelegate != null) {
      signers.push(openOrdersDelegate);
    }
    return [ix, signers];
  }

  public async cancelAndPlaceOrdersIx(
    openOrdersPublicKey: PublicKey,
    marketPublicKey: PublicKey,
    market: MarketAccount,
    userBaseAccount: PublicKey,
    userQuoteAccount: PublicKey,
    openOrdersAdmin: PublicKey | null,
    cancelClientOrdersIds: BN[],
    placeOrders: PlaceOrderArgs[],
    openOrdersDelegate?: Keypair
  ): Promise<[TransactionInstruction, Signer[]]> {
    const ix = await this.program.methods
      .cancelAndPlaceOrders(cancelClientOrdersIds, placeOrders)
      .accounts({
        signer: openOrdersDelegate != null ? openOrdersDelegate.publicKey : this.walletPk,
        asks: market.asks,
        bids: market.bids,
        marketQuoteVault: market.marketQuoteVault,
        marketBaseVault: market.marketBaseVault,
        eventHeap: market.eventHeap,
        market: marketPublicKey,
        openOrdersAccount: openOrdersPublicKey,
        oracleA: market.oracleA.key,
        oracleB: market.oracleB.key,
        userBaseAccount,
        userQuoteAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        openOrdersAdmin,
      })
      .instruction();
    const signers: Signer[] = [];
    if (openOrdersDelegate != null) {
      signers.push(openOrdersDelegate);
    }
    return [ix, signers];
  }

  public async cancelOrderById(
    openOrdersPublicKey: PublicKey,
    openOrdersAccount: OpenOrdersAccount,
    market: MarketAccount,
    orderId: BN,
    openOrdersDelegate?: Keypair
  ): Promise<[TransactionInstruction, Signer[]]> {
    const ix = await this.program.methods
      .cancelOrder(orderId)
      .accounts({
        signer: openOrdersAccount.owner,
        asks: market.asks,
        bids: market.bids,
        market: openOrdersAccount.market,
        openOrdersAccount: openOrdersPublicKey,
      })
      .instruction();
    const signers: Signer[] = [];
    if (openOrdersDelegate != null) {
      signers.push(openOrdersDelegate);
    }
    return [ix, signers];
  }

  public async cancelOrderByClientId(
    openOrdersPublicKey: PublicKey,
    openOrdersAccount: OpenOrdersAccount,
    market: MarketAccount,
    clientOrderId: BN,
    openOrdersDelegate?: Keypair
  ): Promise<[TransactionInstruction, Signer[]]> {
    const ix = await this.program.methods
      .cancelOrderByClientOrderId(clientOrderId)
      .accounts({
        signer: openOrdersAccount.owner,
        asks: market.asks,
        bids: market.bids,
        market: openOrdersAccount.market,
        openOrdersAccount: openOrdersPublicKey,
      })
      .instruction();
    const signers: Signer[] = [];
    if (openOrdersDelegate != null) {
      signers.push(openOrdersDelegate);
    }
    return [ix, signers];
  }

  public async closeOpenOrdersIndexerIx(
    owner: Keypair,
    market: MarketAccount,
    openOrdersIndexer?: PublicKey
  ): Promise<[TransactionInstruction, Signer[]]> {
    if (openOrdersIndexer == null) {
      openOrdersIndexer = this.findOpenOrdersIndexer(owner.publicKey);
    }
    if (openOrdersIndexer !== null) {
      const ix = await this.program.methods
        .closeOpenOrdersIndexer()
        .accounts({
          owner: owner.publicKey,
          openOrdersIndexer: market.asks,
          solDestination: market.bids,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

      const additionalSigners: Signer[] = [];
      if (owner.publicKey !== this.walletPk) {
        additionalSigners.push(owner);
      }

      return [ix, additionalSigners];
    }
    throw new Error('No open order indexer for the specified owner');
  }

  public async settleFundsIx(
    openOrdersPublicKey: PublicKey,
    openOrdersAccount: OpenOrdersAccount,
    marketPublicKey: PublicKey,
    market: MarketAccount,
    openOrdersDelegate?: Keypair
  ): Promise<[TransactionInstruction, Signer[]]> {
    const userPk = openOrdersAccount.owner;
    const userBaseAccount = new PublicKey(
      await checkOrCreateAssociatedTokenAccount(this.provider, market.baseMint, userPk)
    );
    const userQuoteAccount = new PublicKey(
      await checkOrCreateAssociatedTokenAccount(this.provider, market.quoteMint, userPk)
    );

    const ix = await this.program.methods
      .settleFunds()
      .accounts({
        owner: openOrdersDelegate?.publicKey ?? openOrdersAccount.owner,
        penaltyPayer: openOrdersAccount.owner,
        openOrdersAccount: openOrdersPublicKey,
        market: marketPublicKey,
        marketAuthority: market.marketAuthority,
        marketBaseVault: market.marketBaseVault,
        marketQuoteVault: market.marketQuoteVault,
        userBaseAccount,
        userQuoteAccount,
        referrerAccount: market.marketQuoteVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    const signers: Signer[] = [];
    if (openOrdersDelegate != null) {
      signers.push(openOrdersDelegate);
    }
    return [ix, signers];
  }

  public async closeOpenOrdersAccountIx(
    payer: Keypair,
    owner: Keypair = payer,
    openOrdersPublicKey: PublicKey,
    market: MarketAccount,
    solDestination: PublicKey = this.walletPk,
    openOrdersIndexer?: PublicKey
  ): Promise<[TransactionInstruction, Signer[]]> {
    if (openOrdersIndexer == null) {
      openOrdersIndexer = this.findOpenOrdersIndexer(owner.publicKey);
    }
    if (openOrdersIndexer !== null) {
      const ix = await this.program.methods
        .closeOpenOrdersAccount()
        .accounts({
          payer: payer.publicKey,
          owner: owner.publicKey,
          openOrdersIndexer,
          openOrdersAccount: openOrdersPublicKey,
          solDestination,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      const additionalSigners = [payer];
      if (owner !== payer) {
        additionalSigners.push(owner);
      }
      return [ix, additionalSigners];
    }
    throw new Error('No open order indexer for the specified owner');
  }

  // Use getAccountsToConsume as a helper
  public async consumeEventsIx(
    marketPublicKey: PublicKey,
    market: MarketAccount,
    limit: BN,
    remainingAccounts: PublicKey[]
  ): Promise<TransactionInstruction> {
    const accountsMeta: AccountMeta[] = remainingAccounts.map(remaining => ({
      pubkey: remaining,
      isSigner: false,
      isWritable: true,
    }));

    const eventAdminBs58 = market.consumeEventsAdmin.key.toBase58();
    const consumeEventsAdmin =
      eventAdminBs58 === PublicKey.default.toBase58() ? null : market.consumeEventsAdmin.key;

    const ix = await this.program.methods
      .consumeEvents(limit)
      .accounts({
        eventHeap: market.eventHeap,
        market: marketPublicKey,
        consumeEventsAdmin,
      })
      .remainingAccounts(accountsMeta)
      .instruction();
    return ix;
  }

  // // Consume events for one specific account. Add other extra accounts as it's "free".
  // public async consumeEventsForAccountIx(
  //   marketPublicKey: PublicKey,
  //   market: MarketAccount,
  //   openOrdersAccount: PublicKey
  //   // ): Promise<TransactionInstruction> {
  // ) {
  //   const slots = await this.getSlotsToConsume(openOrdersAccount, market);

  //   const allAccounts = await this.getAccountsToConsume(market);
  //   // Create a set to remove duplicates
  //   const uniqueAccounts = new Set([openOrdersAccount, ...allAccounts]);
  //   // Limit extra accounts to 10 due tx limit and add openOrdersAccount
  //   const remainingAccounts = [...uniqueAccounts].slice(0, 10);
  //   const accountsMeta: AccountMeta[] = remainingAccounts.map(remaining => ({
  //     pubkey: remaining,
  //     isSigner: false,
  //     isWritable: true,
  //   }));
  //   /*
  //   const ix = await this.program.methods
  //     .consumeGivenEvents(slots)
  //     .accounts({
  //       eventHeap: market.eventHeap,
  //       market: marketPublicKey,
  //       consumeEventsAdmin: market.consumeEventsAdmin.key,
  //     })
  //     .remainingAccounts(accountsMeta)
  //     .instruction();
  //   return ix; */
  // }

  public async createFinalizeGivenEventsInstruction(
    marketPublicKey: PublicKey,
    marketAuthority: PublicKey,
    eventHeapPublicKey: PublicKey,
    makerAtaPublicKey: PublicKey,
    takerAtaPublicKey: PublicKey,
    marketVaultBasePublicKey: PublicKey,
    marketVaultQuotePublicKey: PublicKey,
    maker: PublicKey,
    taker: PublicKey,
    slotsToConsume: BN
  ): Promise<[TransactionInstruction[], Signer[]]> {
    const accounts = {
      market: marketPublicKey,
      marketAuthority: marketAuthority,
      eventHeap: eventHeapPublicKey,
      makerAta: makerAtaPublicKey,
      takerAta: takerAtaPublicKey,
      marketVaultBase: marketVaultBasePublicKey,
      marketVaultQuote: marketVaultQuotePublicKey,
      maker: maker,
      taker: taker,
      // marketAuthorityPDA: marketAuthorityPDA,
      // tokenProgram: tokenProgramPublicKey,
      // Add other accounts as required by the instruction
    };

    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000,
    });

    const ix = await this.program.methods
      .atomicFinalizeGivenEvents(slotsToConsume)
      .accounts(accounts)
      .preInstructions([modifyComputeUnits])
      .instruction();

    const signers: Signer[] = [];
    // Add any additional signers if necessary

    return [[modifyComputeUnits, ix], signers];
  }

  public async createCancelGivenEventIx(
    side: PlaceOrderArgs['side'],
    marketPublicKey: PublicKey,
    marketAuthority: PublicKey,
    eventHeapPublicKey: PublicKey,
    makerAtaPublicKey: PublicKey,
    takerAtaPublicKey: PublicKey,
    marketVaultBasePublicKey: PublicKey,
    marketVaultQuotePublicKey: PublicKey,
    maker: PublicKey,
    taker: PublicKey,
    slotsToConsume: BN
  ): Promise<[TransactionInstruction, Signer[]]> {
    // const accounts = {
    //   market: marketPublicKey,
    //   marketAuthority: marketAuthority,
    //   eventHeap: eventHeapPublicKey,
    //   makerAta: makerAtaPublicKey,
    //   takerAta: takerAtaPublicKey,
    //   marketVaultBase: marketVaultBasePublicKey,
    //   marketVaultQuote: marketVaultQuotePublicKey,
    //   maker: maker,
    //   taker: taker,
    //   // marketAuthorityPDA: marketAuthorityPDA,
    //   // tokenProgram: tokenProgramPublicKey,
    //   // Add other accounts as required by the instruction
    // };

    const ix = await this.program.methods
      .cancelWithPenalty(side, slotsToConsume)
      .accounts({
        maker: maker,
        taker: taker,
        eventHeap: eventHeapPublicKey,
        makerAta: makerAtaPublicKey,
        takerAta: takerAtaPublicKey,
        market: marketPublicKey,
      })
      .instruction();

    const signers: Signer[] = [];
    // Add any additional signers if necessary

    return [ix, signers];
  }

  public async atomicFinalizeEventsDirect(
    market: PublicKey,
    marketAuthority: PublicKey,
    eventHeap: PublicKey,
    takerBaseAccount: PublicKey,
    takerQuoteAccount: PublicKey,
    makerBaseAccount: PublicKey,
    makerQuoteAccount: PublicKey,
    marketVaultQuote: PublicKey,
    marketVaultBase: PublicKey,
    maker: PublicKey,
    taker: PublicKey,
    slots: BN,
    limit: BN
  ): Promise<TransactionInstruction[]> {
    // Create the additional compute budget instructions
    const computeUnitLimitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
      units: 800000,
    });

    // Create the main instruction with the required accounts
    const mainInstruction = await this.program.methods
      .atomicFinalizeEventsDirect(slots, limit)
      .accounts({
        market,
        marketAuthority,
        eventHeap,
        takerBaseAccount,
        takerQuoteAccount,
        makerBaseAccount,
        makerQuoteAccount,
        marketVaultQuote,
        marketVaultBase,
        maker,
        taker,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    // Initialize the instructions array
    const instructions: TransactionInstruction[] = [mainInstruction];

    // Prepend the compute budget instruction
    instructions.unshift(computeUnitLimitInstruction);

    return instructions;
  }

  public async atomicFinalizeEventsMarket(
    market: PublicKey,
    marketAuthority: PublicKey,
    eventHeap: PublicKey,
    takerBaseAccount: PublicKey,
    takerQuoteAccount: PublicKey,
    makerBaseAccount: PublicKey,
    makerQuoteAccount: PublicKey,
    marketVaultQuote: PublicKey,
    marketVaultBase: PublicKey,
    maker: PublicKey,
    taker: PublicKey,
    slots: BN,
    limit: BN
  ): Promise<TransactionInstruction[]> {
    // Create the additional compute budget instructions
    const computeUnitLimitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
      units: 800000,
    });

    // Create the main instruction with the required accounts
    const mainInstruction = await this.program.methods
      .atomicFinalizeMarket(slots, limit)
      .accounts({
        market,
        marketAuthority,
        eventHeap,
        takerBaseAccount,
        takerQuoteAccount,
        makerBaseAccount,
        makerQuoteAccount,
        marketVaultQuote,
        marketVaultBase,
        maker,
        taker,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    // Initialize the instructions array
    const instructions: TransactionInstruction[] = [mainInstruction];

    // Prepend the compute budget instruction
    instructions.unshift(computeUnitLimitInstruction);

    return instructions;
  }
  /*
  public async atomicFinalizeEventsDirect(
    market: PublicKey,
    marketAuthority: PublicKey,
    eventHeap: PublicKey,
    takerBaseAccount: PublicKey,
    takerQuoteAccount: PublicKey,
    makerBaseAccount: PublicKey,
    makerQuoteAccount: PublicKey,
    marketVaultQuote: PublicKey,
    marketVaultBase: PublicKey,
    maker: PublicKey,
    taker: PublicKey,
    limit: BN
  ): Promise<TransactionInstruction[]> {
 const additionalComputeBudgetInstruction =
   ComputeBudgetProgram.setComputeUnitLimit({
     units: 600_000,
   });
    const ix = await this.program.methods
      .atomicFinalizeEventsDirect(limit)
      .accounts({
        market,
        marketAuthority,
        eventHeap,
        takerBaseAccount,
        takerQuoteAccount,
        makerBaseAccount,
        makerQuoteAccount,
        marketVaultQuote,
        marketVaultBase,
        maker,
        taker,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([additionalComputeBudgetInstruction])
      .instruction();

    return [ix];
  } */

  public async createFinalizeEventsInstruction(
    marketPublicKey: PublicKey,
    // market: MarketAccount,
    marketAuthority: PublicKey,
    eventHeapPublicKey: PublicKey,
    makerAtaPublicKey: PublicKey,
    takerAtaPublicKey: PublicKey,
    marketVaultBasePublicKey: PublicKey,
    marketVaultQuotePublicKey: PublicKey,
    maker: PublicKey,
    taker: PublicKey,
    // tokenProgramPublicKey: PublicKey,
    // marketAuthorityPDA,
    slotsToConsume: BN,
    limit: BN
  ): Promise<[TransactionInstruction, Signer[]]> {
    const accounts = {
      market: marketPublicKey,
      marketAuthority: marketAuthority,
      eventHeap: eventHeapPublicKey,
      makerAta: makerAtaPublicKey,
      takerAta: takerAtaPublicKey,
      marketVaultBase: marketVaultBasePublicKey,
      marketVaultQuote: marketVaultQuotePublicKey,
      maker: maker,
      taker: taker,
      //marketAuthorityPDA: marketAuthorityPDA,
      // tokenProgram: tokenProgramPublicKey,
      // Add other accounts as required by the instruction
    };
    const additionalComputeBudgetInstruction = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000,
    });
    const ix = await this.program.methods
      .atomicFinalizeEvents(slotsToConsume, limit)
      .accounts(accounts)
      .preInstructions([additionalComputeBudgetInstruction])
      .instruction();

    const signers: Signer[] = [];
    // Add any additional signers if necessary

    return [ix, signers];
  }

  // // In order to get slots for certain key use getSlotsToConsume and include the key in the remainingAccounts
  // public async consumeGivenEventsIx(
  //   marketPublicKey: PublicKey,
  //   market: MarketAccount,
  //   slots: BN[],
  //   remainingAccounts: PublicKey[]
  //   // ): Promise<TransactionInstruction> {
  // ) {
  //   const accountsMeta: AccountMeta[] = remainingAccounts.map(remaining => ({
  //     pubkey: remaining,
  //     isSigner: false,
  //     isWritable: true,
  //   }));
  //   /*const ix = await this.program.methods
  //     .consumeGivenEvents(slots)
  //     .accounts({
  //       eventHeap: market.eventHeap,
  //       market: marketPublicKey,
  //       consumeEventsAdmin: market.consumeEventsAdmin.key,
  //     })
  //     .remainingAccounts(accountsMeta)
  //     .instruction();
  //   return ix; */
  // }

  public async pruneOrdersIx(
    marketPublicKey: PublicKey,
    market: MarketAccount,
    openOrdersPublicKey: PublicKey,
    limit: number,
    closeMarketAdmin: Keypair | null = null
  ): Promise<[TransactionInstruction, Signer[]]> {
    const ix = await this.program.methods
      .pruneOrders(limit)
      .accounts({
        closeMarketAdmin: market.closeMarketAdmin.key,
        openOrdersAccount: openOrdersPublicKey,
        market: marketPublicKey,
        bids: market.bids,
        asks: market.asks,
      })
      .instruction();
    const signers: Signer[] = [];
    if (this.walletPk !== market.closeMarketAdmin.key && closeMarketAdmin !== null) {
      signers.push(closeMarketAdmin);
    }
    return [ix, signers];
  }

  public async getAccountsToConsume(market: MarketAccount): Promise<PublicKey[]> {
    let accounts: PublicKey[] = new Array<PublicKey>();
    const eventHeap = await this.deserializeEventHeapAccount(market.eventHeap);
    if (eventHeap != null) {
      for (const node of eventHeap.nodes) {
        if (node.event.eventType === 0) {
          const fillEvent: FillEvent = this.program.coder.types.decode(
            'FillEvent',
            Buffer.from([0, ...node.event.padding])
          );
          console.log('FillEvent Details:', fillEvent);
          accounts = accounts.filter(a => a !== fillEvent.maker).concat([fillEvent.maker]);
        } else {
          const outEvent: OutEvent = this.program.coder.types.decode(
            'OutEvent',
            Buffer.from([0, ...node.event.padding])
          );
          accounts = accounts.filter(a => a !== outEvent.owner).concat([outEvent.owner]);
        }
        // Tx would be too big, do not add more accounts
        if (accounts.length > 20) return accounts;
      }
    }
    return accounts;
  }

  public async getSlotsToConsume(key: PublicKey, market: MarketAccount): Promise<BN[]> {
    const slots: BN[] = new Array<BN>();

    const eventHeap = await this.deserializeEventHeapAccount(market.eventHeap);
    if (eventHeap != null) {
      for (const [i, node] of eventHeap.nodes.entries()) {
        if (node.event.eventType === 0) {
          const fillEvent: FillEvent = this.program.coder.types.decode(
            'FillEvent',
            Buffer.from([0, ...node.event.padding])
          );
          if (key === fillEvent.maker) slots.push(new BN(i));
        } else {
          const outEvent: OutEvent = this.program.coder.types.decode(
            'OutEvent',
            Buffer.from([0, ...node.event.padding])
          );
          if (key === outEvent.owner) slots.push(new BN(i));
        }
      }
    }
    return slots;
  }
}

export async function getFilteredProgramAccounts(
  connection: Connection,
  programId: PublicKey,
  filters: any
): Promise<Array<{ publicKey: PublicKey; accountInfo: AccountInfo<Buffer> }>> {
  // @ts-expect-error not need check
  const resp = await connection._rpcRequest('getProgramAccounts', [
    programId.toBase58(),
    {
      commitment: connection.commitment,
      filters,
      encoding: 'base64',
    },
  ]);
  if (resp.error !== null) {
    throw new Error(resp.error.message);
  }
  return resp.result.map(({ pubkey, account: { data, executable, owner, lamports } }: any) => ({
    publicKey: new PublicKey(pubkey),
    accountInfo: {
      data: Buffer.from(data[0], 'base64'),
      executable,
      owner: new PublicKey(owner),
      lamports,
    },
  }));
}
