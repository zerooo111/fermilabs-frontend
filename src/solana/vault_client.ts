import { Program, BN } from '@coral-xyz/anchor';
import { AnchorProvider } from '@coral-xyz/anchor';
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Commitment,
  TransactionInstruction,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { FermiVault, IDL } from './fermi_vault';
import { sendTransaction } from './utils/rpc';

export interface LiquidityVaultClientOptions {
  postSendTxCallback?: ({ txid }: { txid: string }) => void;
  commitment?: Commitment;
}

/**
 * Client for interacting with the Fermi Vault program
 */
export class LiquidityVaultClient {
  program: Program<FermiVault>;
  walletPk: PublicKey;
  private readonly postSendTxCallback?: ({ txid }: { txid: string }) => void;
  private readonly txConfirmationCommitment: Commitment;

  constructor(
    public provider: AnchorProvider,
    public programId: PublicKey,
    opts: LiquidityVaultClientOptions = {}
  ) {
    this.program = new Program<FermiVault>(IDL, programId, this.provider);
    this.walletPk = this.provider.wallet.publicKey;
    this.postSendTxCallback =
      opts?.postSendTxCallback ??
      (({ txid }) => {
        console.log('txid:', txid);
        console.log('Solana Explorer:', `https://explorer.solana.com/tx/${txid}?cluster=devnet`);
      });
    this.txConfirmationCommitment = opts?.commitment ?? 'processed';
  }

  /// Transactions
  public async sendAndConfirmTransaction(
    ixs: TransactionInstruction[],
    opts: any = {}
  ): Promise<string> {
    try {
      return await sendTransaction(this.program.provider as AnchorProvider, ixs, opts.alts ?? [], {
        postSendTxCallback: this.postSendTxCallback,
        txConfirmationCommitment: this.txConfirmationCommitment,
        ...opts,
      });
    } catch (e) {
      console.log('Error sending transaction', e);
      throw e;
    }
  }

  /**
   * Derives the vault state PDA address
   */
  async getVaultStatePDA(mint: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddress(
      [Buffer.from('vault_state'), mint.toBuffer()],
      this.programId
    );
  }

  /**
   * Derives the vault authority PDA address
   */
  async getVaultAuthorityPDA(vaultState: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddress(
      [Buffer.from('vault_authority'), vaultState.toBuffer()],
      this.programId
    );
  }

  /**
   * Derives the user state PDA address
   */
  async getUserStatePDA(user: PublicKey, vaultState: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddress(
      [Buffer.from('user_state'), vaultState.toBuffer(), user.toBuffer()],
      this.programId
    );
  }

  async getVaultTokenAccount(vaultState: PublicKey) {
    return PublicKey.findProgramAddress(
      [Buffer.from('vault_token_account'), vaultState.toBuffer()],
      this.programId
    );
  }

  /**
   * Initialize a new vault for a given token mint
   */
  async createVault(tokenMint: PublicKey) {
    const [vaultState] = await this.getVaultStatePDA(tokenMint);
    const [vaultAuthority] = await this.getVaultAuthorityPDA(vaultState);
    const [vaultTokenAccount] = await this.getVaultTokenAccount(vaultState);

    console.log({
      vaultState: vaultState.toBase58(),
      vaultAuthority: vaultAuthority.toBase58(),
      vaultTokenAccount: vaultTokenAccount.toBase58(),
      payer: this.walletPk.toBase58(),
    });

    const whitelistedProgram = new PublicKey('6M1y4LyDza134J7WudXsQsWq2urwDxnbdvDV8ReoSrTc');
    const ix = await this.program.methods
      .initialize(whitelistedProgram)
      .accounts({
        vaultState,
        tokenMint,
        vaultAuthority,
        vaultTokenAccount,
        payer: this.walletPk,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    await this.sendAndConfirmTransaction([ix]);

    return vaultState;
  }

  /**
   * Deposit tokens into the vault
   */
  async deposit(
    amount: number | BN,
    tokenMint: PublicKey,
    userTokenAccount: PublicKey,
    user: PublicKey = this.walletPk
  ) {
    const [vaultState] = await this.getVaultStatePDA(tokenMint);
    const [userState] = await this.getUserStatePDA(user, vaultState);
    const [vaultTokenAccount] = await this.getVaultTokenAccount(vaultState);

    console.log({
      vaultState: vaultState.toBase58(),
      userState: userState.toBase58(),
      vaultTokenAccount: vaultTokenAccount.toBase58(),
      payer: this.walletPk.toBase58(),
    });

    const ix = await this.program.methods
      .deposit(user, new BN(amount))
      .accounts({
        vaultState,
        userState,
        user,
        userTokenAccount,
        vaultTokenAccount,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    return this.sendAndConfirmTransaction([ix]);
  }

  /**
   * Withdraw tokens from the vault
   */
  async withdraw(
    amount: number | BN,
    vault: PublicKey,
    recipientTokenAccount: PublicKey,
    user: PublicKey
  ) {
    const [vaultState] = await this.getVaultStatePDA(vault);
    const [vaultAuthority] = await this.getVaultAuthorityPDA(vaultState);
    const [userState] = await this.getUserStatePDA(user, vault);
    const [vaultTokenAccount] = await this.getVaultTokenAccount(vaultState);

    console.log({
      vaultState: vaultState.toBase58(),
      vaultAuthority: vaultAuthority.toBase58(),
      vaultTokenAccount: vaultTokenAccount.toBase58(),
      payer: this.walletPk.toBase58(),
    });

    const ix = await this.program.methods
      .withdraw(user, new BN(amount))
      .accounts({
        vaultState,
        userState,
        vaultAuthority,
        vaultTokenAccount,
        recipientTokenAccount,
        caller: this.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    return this.sendAndConfirmTransaction([ix], {
      postSendTxCallback: this.postSendTxCallback,
    });
  }

  /**
   * Take tokens from the vault (admin function)
   */
  async takeTokens(
    amount: number | BN,
    vault: PublicKey,
    recipientTokenAccount: PublicKey,
    user: PublicKey
  ) {
    const [vaultState] = await this.getVaultStatePDA(vault);
    const [vaultAuthority] = await this.getVaultAuthorityPDA(vaultState);
    const [userState] = await this.getUserStatePDA(user, vault);
    const [vaultTokenAccount] = await this.getVaultTokenAccount(vaultState);

    const ix = await this.program.methods
      .takeTokens(user, new BN(amount))
      .accounts({
        vaultState,
        userState,
        vaultAuthority,
        vaultTokenAccount,
        recipientTokenAccount,
        caller: this.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    return this.sendAndConfirmTransaction([ix], {
      postSendTxCallback: this.postSendTxCallback,
    });
  }

  /**
   * Get vault state info
   */
  async getVaultState(tokenMint: PublicKey) {
    const [vaultState] = await this.getVaultStatePDA(tokenMint);
    return await this.program.account.vaultState.fetch(vaultState);
  }

  /**
   * Get user state info
   */
  async getUserState(user: PublicKey, vault: PublicKey) {
    const [userState] = await this.getUserStatePDA(user, vault);
    return await this.program.account.userState.fetch(userState);
  }
}
