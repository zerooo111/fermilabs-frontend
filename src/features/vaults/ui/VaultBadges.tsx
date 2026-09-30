/** Small status badges shared by the list and detail views. */
import { Lock, ShieldCheck } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';

import type { Vault } from '../model/types';

export function KindBadge({ kind }: { kind: Vault['kind'] }) {
  return kind === 'protocol' ? (
    <Badge variant="info" className="font-mono text-[10px] uppercase tracking-[0.1em]">
      <ShieldCheck />
      Official
    </Badge>
  ) : (
    <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-[0.1em]">
      Community
    </Badge>
  );
}

export function StatusBadge({ status }: { status: Vault['status'] }) {
  if (status === 'open') return null;
  return (
    <Badge variant="warning" className="font-mono text-[10px] uppercase tracking-[0.1em]">
      <Lock />
      Deposits closed
    </Badge>
  );
}
