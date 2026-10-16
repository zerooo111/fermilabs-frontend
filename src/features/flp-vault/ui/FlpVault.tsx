/**
 * FLP vault: live phase and totals, the wallet's position, and the
 * pre-deposit deposit/withdraw form. Live-phase tickets (request → epoch
 * close → claim) aren't supported here yet, so actions only open in
 * pre-deposit, where both directions settle immediately at 1:1.
 */
import { useState, type ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Segmented } from '@/shared/ui/segmented';
import { shortenAddress } from '@/shared/lib/solana/helpers';
import { ConnectWallet } from '@/features/wallet-connect';

import { FLP_CLUSTER, FLP_PROGRAM_ID, FLP_VAULT, flpExplorerTxUrl } from '../model/config';
import {
  describeFlpError,
  formatUnits,
  MODE_LABEL,
  parseUnits,
  toInputString,
} from '../model/format';
import { FlpConfirmationTimeout, useFlpActions, type FlpAction } from '../model/useFlpActions';
import { useFlpVault, type FlpUserView, type FlpVaultView } from '../model/useFlpVault';

const PHASE_LABEL = {
  idle: '',
  signing: 'Approve in wallet…',
  sending: 'Sending…',
  confirming: 'Confirming…',
} as const;

export function FlpVault() {
  const { vault, user, owner } = useFlpVault();

  if (vault.isError) {
    return (
      <Panel>
        <div className="flex flex-col items-start gap-3 px-4 py-6">
          <p className="text-sm text-danger">Couldn&apos;t read the vault on {FLP_CLUSTER}.</p>
          <p className="font-mono text-[11px] text-rock/45">{describeFlpError(vault.error)}</p>
          <Button variant="outline" size="sm" onClick={() => vault.refetch()}>
            Retry
          </Button>
        </div>
      </Panel>
    );
  }

  const v = vault.data;
  return (
    <div className="space-y-5">
      <Tiles vault={v} user={user.data} owner={owner} userLoading={!!owner && user.isPending} />
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <Panel>
          {!v ? (
            <div className="space-y-3 p-4">
              <Bone className="h-8 w-48" />
              <Bone className="h-9 w-full" />
              <Bone className="h-9 w-full" />
            </div>
          ) : v.mode !== 'pre-deposit' ? (
            <p className="px-4 py-6 text-sm text-rock/60">
              The vault is {MODE_LABEL[v.mode].toLowerCase()}. This page supports pre-deposits and
              pre-withdrawals only.
            </p>
          ) : !owner ? (
            <div className="flex flex-col items-start gap-3 px-4 py-6">
              <p className="text-sm text-rock/60">Connect a wallet to deposit.</p>
              <ConnectWallet />
            </div>
          ) : (
            <ActionForm vault={v} user={user.data} />
          )}
        </Panel>
        <Details vault={v} />
      </div>
    </div>
  );
}

function ActionForm({ vault, user }: { vault: FlpVaultView; user?: FlpUserView }) {
  const [action, setAction] = useState<FlpAction>('deposit');
  const [input, setInput] = useState('');
  const tx = useFlpActions();

  const deposit = action === 'deposit';
  const decimals = deposit ? vault.quoteDecimals : vault.shareDecimals;
  const unit = deposit ? 'USDC' : 'FLP';
  const available = deposit ? user?.quoteBalance : user?.shareBalance;
  const open = deposit ? vault.depositsOpen : vault.withdrawalsOpen;
  const amount = parseUnits(input, decimals);

  let problem: string | null = null;
  if (!open) problem = deposit ? 'Deposits are paused' : 'Withdrawals are paused';
  else if (input && amount === null) problem = 'Enter a valid amount';
  else if (amount !== null && available !== undefined && amount > available)
    problem = `Exceeds your ${unit} balance`;
  else if (deposit && amount !== null && amount > 0n && amount < vault.minDeposit)
    problem = `Minimum deposit is ${formatUnits(vault.minDeposit, decimals)} USDC`;

  const canSubmit = !problem && !!amount && amount > 0n && !!user && !tx.isPending;

  const submit = () => {
    if (!canSubmit || !amount) return;
    tx.mutate(
      { action, amount },
      {
        onSuccess: ({ signature }) => {
          setInput('');
          toast.success(
            `${deposit ? 'Deposited' : 'Withdrew'} ${formatUnits(amount, decimals)} ${unit}`,
            { action: { label: 'View', onClick: () => window.open(flpExplorerTxUrl(signature)) } }
          );
        },
        onError: err => {
          const sig = err instanceof FlpConfirmationTimeout ? err.signature : null;
          toast.error(describeFlpError(err), {
            action: sig
              ? { label: 'View', onClick: () => window.open(flpExplorerTxUrl(sig)) }
              : undefined,
          });
        },
      }
    );
  };

  return (
    <form
      className="flex flex-col gap-4 p-4"
      onSubmit={e => {
        e.preventDefault();
        submit();
      }}
    >
      <Segmented
        aria-label="Action"
        value={action}
        onChange={a => {
          setAction(a);
          setInput('');
        }}
        options={[
          { value: 'deposit', label: 'Deposit' },
          { value: 'withdraw', label: 'Withdraw' },
        ]}
        className="w-max"
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow>Amount</Eyebrow>
          <span className="font-mono text-[11px] text-rock/45 tabular-nums">
            {available === undefined ? '—' : formatUnits(available, decimals)} {unit} available
          </span>
        </div>
        <div className="flex">
          <Input
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={input}
            onChange={e => setInput(e.target.value.replace(',', '.'))}
            aria-invalid={!!problem}
            className="font-mono tabular-nums"
          />
          <Button
            type="button"
            variant="outline"
            className="border-l-0"
            disabled={!available}
            onClick={() => available !== undefined && setInput(toInputString(available, decimals))}
          >
            Max
          </Button>
        </div>
        <p className={cn('min-h-4 text-xs', problem ? 'text-danger' : 'text-rock/45')}>
          {problem ??
            (deposit
              ? 'Settles now: 1 FLP per USDC, no fees. Funds stay in escrow until launch.'
              : 'Settles now at 1 USDC per FLP while the vault is in pre-deposit.')}
        </p>
      </div>

      {deposit && user && user.quoteBalance === 0n && (
        <p className="border border-outline bg-card px-3 py-2 text-xs text-rock/60">
          This wallet has no test USDC on {FLP_CLUSTER}. It&apos;s a synthetic mint, and
          there&apos;s no public faucet yet, so ask the team to mint some. You also need a little
          devnet SOL for fees.
        </p>
      )}

      <Button type="submit" disabled={!canSubmit}>
        {tx.isPending ? PHASE_LABEL[tx.phase] || 'Preparing…' : deposit ? 'Deposit' : 'Withdraw'}
      </Button>
    </form>
  );
}

function Tiles({
  vault,
  user,
  owner,
  userLoading,
}: {
  vault?: FlpVaultView;
  user?: FlpUserView;
  owner: string | null;
  userLoading: boolean;
}) {
  const dash = <span className="text-rock/35">—</span>;
  const loading = !vault;
  return (
    <div className="grid grid-cols-1 divide-outline border border-outline max-sm:divide-y sm:grid-cols-3 sm:divide-x">
      <Tile
        label="Phase"
        loading={loading}
        value={vault ? MODE_LABEL[vault.mode] : dash}
        hint={vault && !vault.depositsOpen && vault.mode === 'pre-deposit' ? 'paused' : null}
        accent={vault?.mode === 'pre-deposit'}
      />
      <Tile
        label="Total deposited"
        loading={loading}
        value={vault ? formatUnits(vault.escrowBalance, vault.quoteDecimals, 2) : dash}
        hint={vault ? `of ${formatUnits(vault.tvlCap, vault.quoteDecimals, 0)} cap` : null}
      />
      <Tile
        label="Your position"
        loading={userLoading || (!!owner && loading)}
        value={
          !owner ? (
            <span className="text-base font-normal text-rock/45">Connect wallet</span>
          ) : user && vault ? (
            formatUnits(user.shareBalance, vault.shareDecimals, 2)
          ) : (
            dash
          )
        }
        hint={owner && user ? 'FLP' : null}
      />
    </div>
  );
}

function Details({ vault }: { vault?: FlpVaultView }) {
  const rows: Array<[string, string | undefined]> = [
    ['Network', undefined],
    ['Program', FLP_PROGRAM_ID.toBase58()],
    ['Vault', FLP_VAULT.toBase58()],
    ['Share mint', vault?.state.shareMint.toBase58()],
    ['Test USDC', vault?.state.quoteMint.toBase58()],
  ];
  return (
    <Panel>
      <dl className="divide-y divide-outline">
        {rows.map(([label, address]) => (
          <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt>
              <Eyebrow>{label}</Eyebrow>
            </dt>
            <dd className="font-mono text-xs text-rock/70">
              {label === 'Network' ? (
                <span className="text-amber-200">{FLP_CLUSTER}</span>
              ) : address ? (
                <a
                  href={`https://explorer.solana.com/address/${address}?cluster=${FLP_CLUSTER}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-rock"
                  title={address}
                >
                  {shortenAddress(address)}
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                <Bone className="h-3.5 w-20" />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function Tile({
  label,
  value,
  hint,
  loading,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 px-4 py-3.5">
      <Eyebrow>{label}</Eyebrow>
      {loading ? (
        <Bone className="h-7 w-28" />
      ) : (
        <div className="flex min-w-0 items-baseline gap-2">
          <span
            className={cn(
              'truncate font-mono text-xl font-semibold tabular-nums',
              accent ? 'text-amber-200' : 'text-rock'
            )}
          >
            {value}
          </span>
          {hint && <span className="truncate font-mono text-[11px] text-rock/45">{hint}</span>}
        </div>
      )}
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <section className="self-start border border-outline">{children}</section>;
}

function Bone({ className }: { className?: string }) {
  return <span className={cn('skeleton-bone block motion-reduce:animate-none!', className)} />;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-rock/50">
      {children}
    </span>
  );
}
