/**
 * FLP vault page: a thin shell around the `FlpVault` feature, with a switch
 * between the devnet test vaults (kept in `?vault=`). Runs against the FLP
 * devnet deployment, whatever cluster the rest of the app is on.
 */
import { useSearchParams } from 'react-router-dom';

import { FLP_VAULTS, FlpVault, flpVaultConfig, usePrefetchFlpVaults } from '@/features/flp-vault';
import { Segmented } from '@/shared/ui/segmented';

function FlpPage() {
  const [params, setParams] = useSearchParams();
  const config = flpVaultConfig(params.get('vault') ?? '') ?? FLP_VAULTS[0];
  const key = config.address.toBase58();
  usePrefetchFlpVaults(FLP_VAULTS.map(v => v.address));

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] px-2 py-6 md:px-4 md:py-8">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4 px-1">
          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-rock">
              FLP Vault
              <span className="border border-amber-200/60 px-1 text-[9px] font-semibold tracking-wider text-amber-200 leading-[14px]">
                DEVNET
              </span>
            </h1>
            <p className="text-sm text-white/60">
              Provide liquidity to Fermi perps. Test deployment, using synthetic USDC.
            </p>
          </div>
          <Segmented
            aria-label="Vault"
            value={key}
            onChange={address => setParams({ vault: address }, { replace: true })}
            options={FLP_VAULTS.map(v => ({
              value: v.address.toBase58(),
              label: `Vault ${v.id} · ${v.purpose}`,
            }))}
            className="w-max"
          />
        </div>

        <FlpVault key={key} config={config} />
      </div>
    </div>
  );
}

export default FlpPage;
