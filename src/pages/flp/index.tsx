/**
 * FLP vault page: a thin shell around the `FlpVault` feature. Runs against
 * the FLP devnet deployment, whatever cluster the rest of the app is on.
 */
import { FlpVault } from '@/features/flp-vault';

function FlpPage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] px-2 py-6 md:px-4 md:py-8">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <div className="flex flex-col gap-1 px-1">
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

        <FlpVault />
      </div>
    </div>
  );
}

export default FlpPage;
