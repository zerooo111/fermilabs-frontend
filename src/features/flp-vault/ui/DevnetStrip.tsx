/**
 * One line under a devnet vault's header: these are test funds, and here's
 * how to get them (test-USDC faucet, devnet SOL) and how to get approved for
 * direct deposits on the vault that offers it.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { toast } from 'sonner';

import { Button } from '@/shared/ui/button';

import { requestFaucet, requestWhitelist } from '../model/api';
import { getFlp } from '../model/chain';
import { flpExplorerTxUrl, flpVaultConfig } from '../model/config';
import { useFlpVault } from '../model/useFlpVault';

const FAUCET_AMOUNT = '500';

export function DevnetStrip({ vault }: { vault: PublicKey }) {
  const queryClient = useQueryClient();
  const { envelope, user, owner } = useFlpVault(vault);
  const [airdropping, setAirdropping] = useState(false);
  const config = flpVaultConfig(vault.toBase58());

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['flp'] });
    window.setTimeout(() => queryClient.invalidateQueries({ queryKey: ['flp'] }), 3_500);
  };
  const viewTx = (signature?: string) =>
    signature
      ? { label: 'View', onClick: () => window.open(flpExplorerTxUrl(signature)) }
      : undefined;

  const faucet = useMutation({
    mutationFn: () => requestFaucet(owner!, FAUCET_AMOUNT),
    onSuccess: r => {
      refresh();
      toast.success(`Sent ${FAUCET_AMOUNT} test USDC`, { action: viewTx(r.signature) });
    },
    onError: e => toast.error(`Faucet: ${e instanceof Error ? e.message : String(e)}`),
  });
  const whitelist = useMutation({
    mutationFn: () => requestWhitelist(owner!),
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
      const sig = await getFlp().connection.requestAirdrop(new PublicKey(owner!), 1_000_000_000);
      toast.success('Requested 1 devnet SOL', { action: viewTx(sig) });
      window.setTimeout(refresh, 5_000);
    } catch {
      // The public devnet faucet is often dry or rate limited.
      toast.error('The devnet airdrop is busy. Try faucet.solana.com.', {
        action: { label: 'Open', onClick: () => window.open('https://faucet.solana.com') },
      });
    } finally {
      setAirdropping(false);
    }
  };

  const canApprove =
    !!config?.whitelist &&
    envelope?.data.lifecycle.mode === 'pre-deposit' &&
    !user?.depositApproved;

  return (
    <div className="flex flex-col gap-2 border border-amber-200/30 bg-amber-200/[0.04] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-rock/70">
        <span className="text-amber-200">Devnet test vault.</span> Deposits use test USDC with no
        value.
      </p>
      {owner ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={faucet.isPending}
            onClick={() => faucet.mutate()}
          >
            {faucet.isPending ? 'Sending…' : `Get ${FAUCET_AMOUNT} test USDC`}
          </Button>
          <Button variant="outline" size="sm" disabled={airdropping} onClick={airdrop}>
            {airdropping ? 'Requesting…' : 'Get devnet SOL'}
          </Button>
          {canApprove && (
            <Button
              variant="outline"
              size="sm"
              disabled={whitelist.isPending}
              onClick={() => whitelist.mutate()}
              title="Approved wallets can deposit straight into shares"
            >
              {whitelist.isPending ? 'Approving…' : 'Get direct-deposit access'}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-xs text-rock/50">Connect a wallet to get test funds.</p>
      )}
    </div>
  );
}
