/** Plain-language summary of what the vault does and its rules. */
import { Info } from 'lucide-react';

import { Panel, PanelHeader } from '@/shared/ui/panel';

import { formatDate, pct, shortAddress } from '../../model/format';
import type { Vault } from '../../model/types';

export function AboutPanel({ vault }: { vault: Vault }) {
  return (
    <Panel>
      <PanelHeader icon={Info} title="About" />
      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm leading-relaxed text-fg-secondary">{vault.description}</p>
        <dl className="flex flex-col gap-2 border-t border-line-subtle pt-3 text-xs">
          <Row
            label="Managed by"
            value={vault.kind === 'protocol' ? 'Fermi' : shortAddress(vault.leader)}
          />
          <Row
            label="Fee"
            value={vault.leaderFee === 0 ? 'None' : `${pct(vault.leaderFee, 0)} of profits`}
          />
          <Row
            label="Withdraw after"
            value={`${vault.lockupDays} ${vault.lockupDays === 1 ? 'day' : 'days'}`}
          />
          <Row label="Depositors" value={vault.depositorCount.toLocaleString()} />
          <Row label="Started" value={formatDate(vault.createdAt)} />
        </dl>
      </div>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-fg-tertiary">{label}</dt>
      <dd className="font-mono tabular-nums text-fg-primary">{value}</dd>
    </div>
  );
}
