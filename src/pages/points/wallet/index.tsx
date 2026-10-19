/**
 * One wallet's points dashboard: balance and rank, category breakdown, epoch
 * history and activity. Public: the address comes from the URL
 * (/points?wallet=), so a link to this page shows the same numbers to anyone.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Copy } from 'lucide-react';
import axios from 'axios';
import {
  ActivityList,
  AddressChecker,
  Band,
  Bone,
  EpochHistory,
  Eyebrow,
  Notice,
  WalletSummary,
  isValidAddress,
  shortAddress,
  usePointsAccount,
} from '@/features/points';
import { PointsShell } from '../ui/PointsShell';

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(address).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };
  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : 'Copy address'}
      className="inline-flex items-center gap-2 font-mono text-sm text-rock/70 transition-colors duration-150 hover:text-amber-100"
    >
      <span className="md:hidden">{shortAddress(address)}</span>
      <span className="break-all max-md:hidden">{address}</span>
      <Icon className="size-3.5 shrink-0" aria-hidden />
    </button>
  );
}

function WalletBody({ wallet }: { wallet: string }) {
  const account = usePointsAccount(wallet);

  if (account.isPending) {
    return (
      <Band>
        <div className="grid gap-4">
          <Bone className="h-16 w-64" />
          <Bone className="h-40" />
        </div>
      </Band>
    );
  }
  if (account.isError) {
    const notDeployed = axios.isAxiosError(account.error) && account.error.response?.status === 404;
    return (
      <Band>
        <Notice title={notDeployed ? 'Points are not live yet.' : "Couldn't load points."}>
          Try again shortly.
        </Notice>
      </Band>
    );
  }

  return (
    <>
      <Band>
        <WalletSummary account={account.data} />
      </Band>
      <Band>
        <Eyebrow className="mb-4">Epochs</Eyebrow>
        <EpochHistory wallet={wallet} />
      </Band>
      <Band>
        <Eyebrow className="mb-4">Activity</Eyebrow>
        <ActivityList wallet={wallet} />
      </Band>
    </>
  );
}

function PointsWalletPage() {
  const [params] = useSearchParams();
  const wallet = params.get('wallet')?.trim() ?? '';
  const valid = isValidAddress(wallet);

  useEffect(() => {
    const prev = document.title;
    if (valid) document.title = `${shortAddress(wallet)} · ALIEN Points · Fermi Trade`;
    return () => {
      document.title = prev;
    };
  }, [wallet, valid]);

  return (
    <PointsShell>
      <section className="w-full border-b border-rock/15">
        <div className="reg flex flex-col gap-5 px-5 pt-12 pb-8 md:px-10 md:pt-16">
          <Link
            to="/points"
            className="link w-fit font-mono text-xs uppercase tracking-[0.15em] text-amber-200"
          >
            ← ALIEN Points
          </Link>
          <h1 className="font-serif text-4xl leading-none font-light tracking-[-0.02em] md:text-5xl">
            Wallet points
          </h1>
          {valid && <CopyAddress address={wallet} />}
          {/* key: a new address in the URL resets the field */}
          <AddressChecker key={wallet} initial={valid ? '' : wallet} className="mt-2" />
        </div>
      </section>
      {valid ? (
        <WalletBody wallet={wallet} />
      ) : (
        <Band>
          <Notice title="That isn't a Solana wallet address.">
            Check the address and try again.
          </Notice>
        </Band>
      )}
    </PointsShell>
  );
}

export default PointsWalletPage;
