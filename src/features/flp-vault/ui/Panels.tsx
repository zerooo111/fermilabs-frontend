/**
 * Side panels: the wallet's position in the vault, the devnet helpers
 * (test-USDC faucet, direct-deposit approval, SOL), and the vault's
 * accounting, parameters and addresses.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { toast } from 'sonner';

import { Button } from '@/shared/ui/button';

import { requestFaucet, requestWhitelist, type FlpEnvelope, type FlpUser } from '../model/api';
import { getFlp, type FlpWallet } from '../model/chain';
import {
  FLP_CLUSTER,
  FLP_PROGRAM_ID,
  flpExplorerTxUrl,
  type FlpVaultConfig,
} from '../model/config';
import { formatSigned, formatUnits } from '../model/format';
import { sharesValue, vaultView } from '../model/view';
import { AddressLink, Bone, Dash, NotAvailable, Panel, Row } from './primitives';

const FAUCET_AMOUNT = '500';

export function PositionPanel({
  envelope,
  user,
  userLoading,
  wallet,
}: {
  envelope?: FlpEnvelope;
  user: FlpUser | null | undefined;
  userLoading: boolean;
  wallet: FlpWallet | undefined;
}) {
  if (!envelope || userLoading) {
    return (
      <Panel title="Your position">
        <div className="space-y-2 p-4">
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-2/3" />
        </div>
      </Panel>
    );
  }
  const v = vaultView(envelope);
  const shares = BigInt(user?.sharesHeld ?? '0');
  const invested = BigInt(user?.investedSharesIncludingOwedAndUnfunded ?? '0');
  const unrealized = user?.pnl.currentUnrealized;
  return (
    <Panel title="Your position">
      <dl className="divide-y divide-outline">
        <Row label="Wallet USDC">
          {wallet ? formatUnits(wallet.quoteBalance, v.quoteDecimals, 2) : <Dash />}
        </Row>
        <Row label="Wallet SOL">{wallet ? formatUnits(wallet.lamports, 9, 4) : <Dash />}</Row>
        <Row label="Pre-deposit" hint="Public principal in escrow, refundable before graduation">
          {formatUnits(BigInt(user?.refundablePublicPrincipal ?? '0'), v.quoteDecimals, 2)} USDC
        </Row>
        <Row label="Shares held">{formatUnits(shares, v.shareDecimals, 4)} FLP</Row>
        {invested !== shares && (
          <Row label="Incl. owed and pending" hint="Held + owed + shares in an unfunded withdrawal">
            {formatUnits(invested, v.shareDecimals, 4)} FLP
          </Row>
        )}
        <Row
          label="Value at last close"
          hint="Shares at the reference price of the last keeper close"
        >
          ≈ {formatUnits(sharesValue(v, invested), v.quoteDecimals, 2)} USDC
        </Row>
        <Row label="Cost basis">
          {user ? (
            formatUnits(BigInt(user.pnl.heldSharesCostBasisQuote), v.quoteDecimals, 2)
          ) : (
            <Dash />
          )}
        </Row>
        <Row label="Unrealized PnL" hint="Indicative: current mid mark minus recorded cost basis">
          {!user ? (
            <Dash />
          ) : unrealized && unrealized.value !== null ? (
            formatSigned(BigInt(unrealized.value), v.quoteDecimals, 2)
          ) : (
            <NotAvailable reason={unrealized?.reason} />
          )}
        </Row>
        <Row label="Realized PnL" hint="Recorded on withdrawals, average-cost basis">
          {user ? (
            formatSigned(BigInt(user.pnl.recordedRealizedQuote), v.quoteDecimals, 2)
          ) : (
            <Dash />
          )}
        </Row>
        <Row label="Direct deposits">
          {user?.depositApproved ? (
            <span className="text-success">Approved</span>
          ) : (
            <span className="text-rock/45">Not approved</span>
          )}
        </Row>
      </dl>
    </Panel>
  );
}

export function DevnetTools({
  config,
  owner,
  user,
  envelope,
}: {
  config: FlpVaultConfig;
  owner: string;
  user: FlpUser | null | undefined;
  envelope?: FlpEnvelope;
}) {
  const queryClient = useQueryClient();
  const [airdropping, setAirdropping] = useState(false);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['flp'] });
    window.setTimeout(() => queryClient.invalidateQueries({ queryKey: ['flp'] }), 3_500);
  };
  const viewTx = (signature?: string) =>
    signature
      ? { label: 'View', onClick: () => window.open(flpExplorerTxUrl(signature)) }
      : undefined;

  const faucet = useMutation({
    mutationFn: () => requestFaucet(owner, FAUCET_AMOUNT),
    onSuccess: r => {
      refresh();
      toast.success(`Minted ${FAUCET_AMOUNT} test USDC`, { action: viewTx(r.signature) });
    },
    onError: e => toast.error(`Faucet: ${e instanceof Error ? e.message : String(e)}`),
  });
  const whitelist = useMutation({
    mutationFn: () => requestWhitelist(owner),
    onSuccess: r => {
      refresh();
      toast.success(
        r.state === 'already-approved' ? 'Already approved' : 'Approved for direct deposits',
        { action: viewTx(r.signature) }
      );
    },
    onError: e => toast.error(`Approval: ${e instanceof Error ? e.message : String(e)}`),
  });

  const airdrop = async () => {
    setAirdropping(true);
    try {
      const { connection } = getFlp();
      const sig = await connection.requestAirdrop(new PublicKey(owner), 1_000_000_000);
      toast.success('Requested 1 devnet SOL', { action: viewTx(sig) });
      window.setTimeout(refresh, 5_000);
    } catch {
      // The public devnet faucet is often dry or rate limited.
      toast.error('Airdrop refused. Use faucet.solana.com instead.', {
        action: { label: 'Open', onClick: () => window.open('https://faucet.solana.com') },
      });
    } finally {
      setAirdropping(false);
    }
  };

  const canApprove =
    config.whitelist && envelope?.data.lifecycle.mode === 'pre-deposit' && !user?.depositApproved;

  return (
    <Panel title="Devnet tools">
      <div className="flex flex-col gap-2 p-4">
        <Button
          variant="outline"
          size="sm"
          disabled={faucet.isPending}
          onClick={() => faucet.mutate()}
        >
          {faucet.isPending ? 'Minting…' : `Get ${FAUCET_AMOUNT} test USDC`}
        </Button>
        {canApprove && (
          <Button
            variant="outline"
            size="sm"
            disabled={whitelist.isPending}
            onClick={() => whitelist.mutate()}
          >
            {whitelist.isPending ? 'Approving…' : 'Approve for direct deposits'}
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={airdropping} onClick={airdrop}>
          {airdropping ? 'Requesting…' : 'Get 1 devnet SOL'}
        </Button>
        <p className="text-[11px] leading-snug text-rock/40">
          Test USDC has no value.{' '}
          {config.whitelist
            ? 'Approval for direct deposits works on this vault before graduation.'
            : 'Approval for direct deposits is offered on vault 3 only.'}
          <a
            href="https://faucet.solana.com"
            target="_blank"
            rel="noreferrer"
            className="ml-1 inline-flex items-center gap-0.5 hover:text-rock/70"
          >
            SOL faucet <ExternalLink className="size-2.5" />
          </a>
        </p>
      </div>
    </Panel>
  );
}

export function VaultDetails({ vault, envelope }: { vault: PublicKey; envelope?: FlpEnvelope }) {
  if (!envelope) {
    return (
      <Panel title="Vault">
        <div className="space-y-2 p-4">
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-full" />
        </div>
      </Panel>
    );
  }
  const v = vaultView(envelope);
  const d = envelope.data;
  const nav = d.valuation.lastProgramNav;
  const p = v.params;
  const q = (n: string | bigint) => formatUnits(BigInt(n), v.quoteDecimals, 2);
  const bps = (n: number) => `${(n / 100).toLocaleString('en-US')}%`;
  return (
    <div className="grid gap-5 md:grid-cols-3">
      <Panel title="Accounting">
        <dl className="divide-y divide-outline">
          <Row label="NAV low / mid / high" hint={`At the last keeper close, slot ${nav.slot}`}>
            {q(nav.navLow)} / {q(nav.navMid)} / {q(nav.navHigh)}
          </Row>
          <Row label="Indicative NAV">
            {v.nav === null ? <NotAvailable reason={d.valuation.currentNav.reason} /> : q(v.nav)}
          </Row>
          <Row label="Deposit escrow">{q(v.escrow)}</Row>
          <Row label="Share supply">{formatUnits(v.supply, v.shareDecimals, 2)} FLP</Row>
          <Row label="Total deposited">{q(d.flows.totalDepositedGross)}</Row>
          <Row label="Total withdrawn">{q(d.flows.totalWithdrawnNet)}</Row>
          <Row label="Depositors">{d.flows.activeDepositors.toLocaleString('en-US')}</Row>
          <Row label="Lifetime PnL">
            <NotAvailable reason="Needs an indexer of the program events" />
          </Row>
        </dl>
      </Panel>
      <Panel title="Parameters">
        <dl className="divide-y divide-outline">
          <Row label="Epoch">{p.epochDurationS.toLocaleString('en-US')} s</Row>
          <Row label="Request cutoff">
            {p.requestCutoffS.toLocaleString('en-US')} s before the end
          </Row>
          <Row label="Min deposit">{q(p.minDeposit)} USDC</Row>
          <Row label="Min withdrawal">
            {formatUnits(BigInt(p.minWithdrawShares), v.shareDecimals)} FLP
          </Row>
          <Row label="Shared total cap">{q(p.tvlCap)} USDC</Row>
          <Row label="Fees mgmt / perf">
            {bps(p.mgmtFeeBps)} / {bps(p.perfFeeBps)}
          </Row>
          <Row label="Fees deposit / withdraw">
            {bps(p.depositFeeBps)} / {bps(p.withdrawFeeBps)}
          </Row>
        </dl>
      </Panel>
      <Panel title="Addresses">
        <dl className="divide-y divide-outline">
          <Row label="Network">
            <span className="text-amber-200">{FLP_CLUSTER}</span>
          </Row>
          <Row label="Program">
            <AddressLink address={FLP_PROGRAM_ID.toBase58()} />
          </Row>
          <Row label="Vault">
            <AddressLink address={vault.toBase58()} />
          </Row>
          <Row label="Share mint">
            <AddressLink address={d.units.shareMint} />
          </Row>
          <Row label="Test USDC">
            <AddressLink address={d.units.quoteMint} />
          </Row>
          <Row label="Fermi account">
            <AddressLink address={d.addresses.fermiAccount} />
          </Row>
          <Row label="MM delegate">
            <AddressLink address={d.configuration.delegate} />
          </Row>
        </dl>
      </Panel>
    </div>
  );
}
