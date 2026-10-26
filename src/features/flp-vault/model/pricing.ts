/**
 * Accounts for the instructions that price the vault in their own
 * transaction: the approved direct deposit and the approved instant
 * withdrawal. Health is [quote bank (writable), quote oracle, ...active perp
 * markets, ...their oracles] in the vault FermiAccount's perp slot order, then
 * one event queue per active perp slot (6043 otherwise). Two RPC calls, as
 * in the fermi-v1 RC6 example client (frontend_flow.cjs), which also checks
 * that the core accounts belong to the core program.
 */
import type { BorshCoder } from '@coral-xyz/anchor';
import { PublicKey, type AccountMeta } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Buffer } from 'buffer';

import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, type VaultAccount } from '../sdk';
import { FLP_CORE_PROGRAM_ID } from './config';
import { getFlp } from './chain';

const NO_MARKET = 65535;

let coder: Promise<BorshCoder> | null = null;
/** Core account decoder, loaded on first use (only approved wallets need it). */
function coreCoder() {
  coder ??= Promise.all([
    import('@coral-xyz/anchor'),
    import('../sdk/fermi_core_accounts.json'),
  ]).then(([{ BorshCoder }, idl]) => new BorshCoder(idl.default as never));
  return coder;
}

export async function pricingAccounts(vault: PublicKey, state: VaultAccount) {
  const { connection, client } = getFlp();
  const core = await coreCoder();
  const [accountInfo, bankInfo] = await connection.getMultipleAccountsInfo(
    [state.fermiAccount, state.quoteBank],
    'confirmed'
  );
  if (!accountInfo || !bankInfo) throw new Error('Vault FermiAccount or quote bank is missing');
  if (!accountInfo.owner.equals(FLP_CORE_PROGRAM_ID) || !bankInfo.owner.equals(FLP_CORE_PROGRAM_ID))
    throw new Error('Vault core accounts have the wrong owner');
  const account = core.accounts.decode('FermiAccount', accountInfo.data) as {
    perps: Array<{ marketIndex: number }>;
  };
  const bank = core.accounts.decode('Bank', bankInfo.data) as {
    oracle: PublicKey;
    vault: PublicKey;
  };

  const markets = account.perps
    .filter(p => p.marketIndex !== NO_MARKET)
    .map(
      p =>
        PublicKey.findProgramAddressSync(
          [
            Buffer.from('PerpMarket'),
            state.group.toBuffer(),
            Buffer.from([p.marketIndex & 255, p.marketIndex >> 8]),
          ],
          FLP_CORE_PROGRAM_ID
        )[0]
    );
  const infos = markets.length
    ? await connection.getMultipleAccountsInfo(markets, 'confirmed')
    : [];
  const perpMarkets = infos.map((info, i) => {
    if (!info) throw new Error(`Missing perp market ${markets[i].toBase58()}`);
    if (!info.owner.equals(FLP_CORE_PROGRAM_ID)) throw new Error('Perp market has the wrong owner');
    return core.accounts.decode('PerpMarket', info.data) as {
      oracle: PublicKey;
      eventQueue: PublicKey;
    };
  });

  const ro = (pubkey: PublicKey): AccountMeta => ({ pubkey, isSigner: false, isWritable: false });
  const health: AccountMeta[] = [
    { pubkey: state.quoteBank, isSigner: false, isWritable: true },
    ro(bank.oracle),
    ...markets.map(ro),
    ...perpMarkets.map(m => ro(m.oracle)),
    ...perpMarkets.map(m => ro(m.eventQueue)),
  ];

  const authority = client.authority(vault);
  const accounts: Record<string, PublicKey> = {
    'pricing.authority': authority,
    'pricing.shareMint': state.shareMint,
    'pricing.feeShareAccount': getAssociatedTokenAddressSync(
      state.shareMint,
      state.feeRecipient as PublicKey,
      true,
      TOKEN_2022_PROGRAM_ID
    ),
    'pricing.idleAccount': getAssociatedTokenAddressSync(state.quoteMint, authority, true),
    'pricing.fermi.group': state.group,
    'pricing.fermi.fermiAccount': state.fermiAccount,
    'pricing.fermi.quoteBank': state.quoteBank,
    'pricing.fermi.quoteBankVault': bank.vault,
    'pricing.fermi.quoteOracle': bank.oracle,
    'pricing.fermi.fermiProgram': FLP_CORE_PROGRAM_ID,
    'pricing.fermi.tokenProgram': TOKEN_PROGRAM_ID,
    'pricing.token2022Program': TOKEN_2022_PROGRAM_ID,
  };
  return { accounts, health };
}
