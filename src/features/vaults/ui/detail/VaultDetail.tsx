/** The single-vault page: header, chart with an About box, then activity. */
import { Link } from 'react-router-dom';

import { Button } from '@/shared/ui/button';
import { Panel } from '@/shared/ui/panel';

import { useVault } from '../../model/useVaults';
import { AboutPanel } from './AboutPanel';
import { ActivityPanel } from './ActivityPanel';
import { PerformancePanel } from './PerformancePanel';
import { VaultHeader } from './VaultHeader';

export function VaultDetail({ id }: { id: string | undefined }) {
  const { vault } = useVault(id);

  if (!vault) {
    return (
      <Panel className="items-center gap-3 px-4 py-16 text-center">
        <span className="font-display text-3xl text-fg-primary">Vault not found</span>
        <p className="max-w-sm text-sm text-fg-secondary">
          This link may be mistyped or out of date.
        </p>
        <Button asChild variant="outline" className="mt-2">
          <Link to="/vaults">Back to all vaults</Link>
        </Button>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <VaultHeader vault={vault} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <PerformancePanel vault={vault} />
        <AboutPanel vault={vault} />
      </div>
      <ActivityPanel vault={vault} />
    </div>
  );
}
