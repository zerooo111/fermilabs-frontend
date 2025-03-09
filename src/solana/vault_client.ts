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
   * Derives the vault state PDA address for a given token mint
   * @param mint - The token mint address for which we are creating/accessing the vault
   * @returns {Promise<[PublicKey, number]>} - The vault state PDA address and bump seed
   */
  async getVaultStatePDA(mint: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddress(
      [Buffer.from('vault_state'), mint.toBuffer()],
      this.programId
    );
  }

  /**
   * Derives the vault authority PDA address that will be the authority for the vault token account
   * @param vaultState - The vault state account address
   * @returns {Promise<[PublicKey, number]>} - The vault authority PDA address and bump seed
   */
  async getVaultAuthorityPDA(vaultState: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddress(
      [Buffer.from('vault_authority'), vaultState.toBuffer()],
      this.programId
    );
  }

  /**
   * Derives the user state PDA address that tracks user's personal vault state and deposits
   * @param userAta - The user's token account address
   * @param vaultState - The vault state account address
   * @returns {Promise<[PublicKey, number]>} - The user state PDA address and bump seed
   */
  async getUserStatePDA(userAta: PublicKey, vaultState: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddress(
      [Buffer.from('user_state'), vaultState.toBuffer(), userAta.toBuffer()],
      this.programId
    );
  }

  /**
   * Derives the vault token account PDA address that holds the deposited tokens
   * @param vaultState - The vault state account address
   * @returns {Promise<[PublicKey, number]>} - The vault token account PDA address and bump seed
   */
  async getVaultTokenAccountPDA(vaultState: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddress(
      [Buffer.from('vault_token_account'), vaultState.toBuffer()],
      this.programId
    );
  }

  /**
   * Initialize a new vault for a given token mint
   * Creates the vault state account, vault authority PDA, and vault token account
   * @param tokenMint - The mint of the token for which we are creating this vault
   * @returns {Promise<{txid: string, vaultState: string, vaultAuthority: string, vaultTokenAccount: string}>}
   */
  async createVault(tokenMint: PublicKey) {
    const [vaultState] = await this.getVaultStatePDA(tokenMint);
    const [vaultAuthority] = await this.getVaultAuthorityPDA(vaultState);
    const [vaultTokenAccount] = await this.getVaultTokenAccountPDA(vaultState);

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

    const tx = await this.sendAndConfirmTransaction([ix]);

    return {
      txid: tx,
      vaultState: vaultState.toBase58(),
      vaultAuthority: vaultAuthority.toBase58(),
      vaultTokenAccount: vaultTokenAccount.toBase58(),
    };
  }

  /**
   * Deposit tokens into the vault
   * Creates or updates user's personal vault state for tracking deposits
   * Transfers tokens from user's token account to the vault token account
   * @param amount - Amount of tokens to deposit
   * @param tokenMint - The token mint address
   * @param userTokenAccount - The user's token account from which tokens will be transferred
   * @param user - The user's wallet address (defaults to connected wallet)
   * @returns {Promise<string>} - Transaction signature
   */
  async deposit(
    amount: number | BN,
    tokenMint: PublicKey,
    userTokenAccount: PublicKey,
    user: PublicKey = this.walletPk
  ) {
    const [vaultState] = await this.getVaultStatePDA(tokenMint);
    const [userState] = await this.getUserStatePDA(user, vaultState);
    const [vaultTokenAccount] = await this.getVaultTokenAccountPDA(vaultState);

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
   * Deducts tokens from user's personal state and transfers them to the recipient
   * Can only be called by the whitelisted program
   * @param amount - Amount of tokens to withdraw
   * @param vault - The vault state account address
   * @param recipientTokenAccount - The token account of the recipient
   * @param user - The user's wallet address
   * @returns {Promise<string>} - Transaction signature
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
    const [vaultTokenAccount] = await this.getVaultTokenAccountPDA(vaultState);

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
   * Similar to withdraw but with different authorization checks
   * Can only be called by the whitelisted program
   * @param amount - Amount of tokens to take
   * @param vault - The vault state account address
   * @param recipientTokenAccount - The token account of the recipient
   * @param user - The user's wallet address
   * @returns {Promise<string>} - Transaction signature
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
    const [vaultTokenAccount] = await this.getVaultTokenAccountPDA(vaultState);

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
   * Returns information about the vault including token mint, authority bump, and whitelisted program
   * @param tokenMint - The token mint address
   * @returns {Promise<any>} - Vault state account data
   */
  async getVaultState(tokenMint: PublicKey) {
    const [vaultState] = await this.getVaultStatePDA(tokenMint);
    return await this.program.account.vaultState.fetch(vaultState);
  }

  /**
   * Get user state info
   * Returns information about the user's deposits including amount deposited
   * @param userAta - The user's token account address
   * @param vault - The vault state account address
   * @returns {Promise<any>} - User state account data
   */
  async getUserState(userAta: PublicKey, vault: PublicKey) {
    const [userState] = await this.getUserStatePDA(userAta, vault);
    return await this.program.account.userState.fetch(userState);
  }

}
