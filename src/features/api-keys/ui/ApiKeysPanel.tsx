/**
 * API Keys panel — header-mounted dialog (mirrors FeeCreditDialog) that lets a
 * whitelisted wallet list, generate, and revoke its own API keys.
 *
 * Auth reuses the access-gate session token via `useApiKeys`; the trigger only
 * renders alongside the rest of the authenticated header, but the dialog body
 * still fails gently (empty state) if the wallet isn't authorized.
 */
import { useState } from 'react';
import { AlertTriangle, Check, Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import posthog from 'posthog-js';

import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/lib/utils';

import { useApiKeys } from '../model/useApiKeys';
import { MAX_ACTIVE_KEYS } from '../model/apiKeysAtoms';
import type { ApiKeyView, CreatedKey } from '../api/keysClient';

function maskHint(hint: string): string {
  // hint is a short tail like "…40a3" or "40a3"; render it with a masked prefix.
  const tail = hint.replace(/^…/, '');
  return `••••••••${tail}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ApiKeysPanel() {
  const { authorized, keys, loading, error, createKey, revokeKey, refresh } = useApiKeys();
  const [open, setOpen] = useState(false);

  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<number | null>(null);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  // The one-time secret from the most recent create. Held only in local state
  // (never persisted) and cleared as soon as the user dismisses the view.
  const [createdSecret, setCreatedSecret] = useState<CreatedKey | null>(null);

  const activeCount = keys.filter(k => k.active).length;
  const atLimit = activeCount >= MAX_ACTIVE_KEYS;

  const dismissSecret = () => setCreatedSecret(null);

  const handleCreate = async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      toast.error('Enter a label for the key.');
      return;
    }
    setCreating(true);
    posthog.capture('api_key_create_attempted');
    const created = await createKey(trimmed);
    setCreating(false);
    if (created) {
      setLabel('');
      setCreatedSecret(created);
      toast.success('API key generated.');
      posthog.capture('api_key_create_succeeded', { key_id: created.id });
    } else {
      posthog.capture('api_key_create_failed');
    }
  };

  const handleRevoke = async (id: number) => {
    setRevokingId(id);
    posthog.capture('api_key_revoke_attempted', { key_id: id });
    const ok = await revokeKey(id);
    setRevokingId(null);
    setConfirmRevokeId(null);
    if (ok) {
      toast.success('API key revoked.');
      posthog.capture('api_key_revoke_succeeded', { key_id: id });
    } else {
      posthog.capture('api_key_revoke_failed', { key_id: id });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (next) {
          void refresh();
        } else {
          setConfirmRevokeId(null);
          // Drop the one-time secret from memory when the dialog closes.
          setCreatedSecret(null);
        }
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 px-2.5">
              <KeyRound className="size-3.5" />
              <span className="font-sans text-xs text-rock/60">API Keys</span>
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="font-sans text-xs">
          Manage API keys for programmatic access
        </TooltipContent>
      </Tooltip>

      <DialogContent className="max-w-lg gap-6 p-6">
        <DialogHeader className="gap-4">
          <div className="flex size-12 items-center justify-center border border-accent/30 bg-accent/10 text-accent">
            <KeyRound className="size-6" />
          </div>
          <div className="flex flex-col gap-2">
            <DialogTitle className="text-lg font-semibold tracking-tight">API Keys</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Generate keys for programmatic access. Up to {MAX_ACTIVE_KEYS} active keys per wallet.
            </DialogDescription>
          </div>
        </DialogHeader>

        {!authorized ? (
          // Gentle empty state for non-whitelisted / signed-out wallets.
          <div className="flex flex-col items-center gap-2 border border-outline bg-card px-4 py-8 text-center">
            <KeyRound className="size-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Redeem an invite and connect your wallet to manage API keys.
            </p>
          </div>
        ) : createdSecret ? (
          <CreatedSecretView created={createdSecret} onDone={dismissSecret} />
        ) : (
          <div className="flex flex-col gap-4">
            {/* Generate row */}
            <div className="flex flex-col gap-2">
              <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                New key label
              </label>
              <div className="flex gap-2">
                <Input
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. trading-bot"
                  disabled={creating || atLimit}
                  spellCheck={false}
                  autoComplete="off"
                  className="h-10 text-sm"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !creating && !atLimit && label.trim()) {
                      e.preventDefault();
                      void handleCreate();
                    }
                  }}
                />
                {atLimit ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* span wrapper so the tooltip works on a disabled button */}
                      <span>
                        <Button size="lg" className="h-10 gap-1.5 px-4" disabled>
                          <Plus className="size-4" />
                          Generate
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="font-sans text-xs">
                      Revoke a key to stay under the {MAX_ACTIVE_KEYS}-key limit
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    size="lg"
                    className="h-10 gap-1.5 px-4"
                    disabled={creating || !label.trim()}
                    onClick={handleCreate}
                  >
                    {creating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    Generate
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground/70">
                {activeCount} / {MAX_ACTIVE_KEYS} active keys used.
              </p>
            </div>

            {error && (
              <p className="border border-danger/40 bg-red-900/20 px-3 py-2 text-xs text-danger">
                {error}
              </p>
            )}

            {/* Keys list */}
            <div className="flex flex-col gap-2">
              {loading && keys.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading keys…
                </div>
              ) : keys.length === 0 ? (
                <p className="border border-outline bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                  No API keys yet. Generate one above to get started.
                </p>
              ) : (
                keys.map(k => (
                  <KeyRowItem
                    key={k.id}
                    row={k}
                    confirming={confirmRevokeId === k.id}
                    revoking={revokingId === k.id}
                    onRequestRevoke={() => setConfirmRevokeId(k.id)}
                    onCancelRevoke={() => setConfirmRevokeId(null)}
                    onConfirmRevoke={() => handleRevoke(k.id)}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function KeyRowItem({
  row,
  confirming,
  revoking,
  onRequestRevoke,
  onCancelRevoke,
  onConfirmRevoke,
}: {
  row: ApiKeyView;
  confirming: boolean;
  revoking: boolean;
  onRequestRevoke: () => void;
  onCancelRevoke: () => void;
  onConfirmRevoke: () => void;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 border border-outline bg-card p-3',
        !row.active && 'opacity-60'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{row.label}</span>
        <Badge variant={row.active ? 'success' : 'secondary'}>
          {row.active ? 'Active' : 'Revoked'}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        {/* Redacted: the raw secret is shown only once, at create time. */}
        <code className="flex-1 truncate font-mono text-xs text-muted-foreground">
          {maskHint(row.key_hint)}
        </code>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground/70">
        <span>Created {formatDate(row.created_at)}</span>
        <span className="font-mono">{row.max_connections} conn</span>
      </div>

      {row.active &&
        (confirming ? (
          <div className="flex items-center justify-end gap-2 border-t border-outline pt-2">
            <span className="mr-auto text-xs text-muted-foreground">Revoke this key?</span>
            <Button variant="ghost" size="sm" onClick={onCancelRevoke} disabled={revoking}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onConfirmRevoke}
              disabled={revoking}
              className="gap-1.5"
            >
              {revoking ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Revoke
            </Button>
          </div>
        ) : (
          <div className="flex justify-end border-t border-outline pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRequestRevoke}
              className="gap-1.5 text-danger hover:text-danger"
            >
              <Trash2 className="size-3.5" />
              Revoke
            </Button>
          </div>
        ))}
    </div>
  );
}

/**
 * Show-once view for a freshly created key. The full secret is displayed
 * prominently with a copy button and a one-time warning; once the user clicks
 * Done the parent drops it from memory and there is no way to see it again.
 */
function CreatedSecretView({ created, onDone }: { created: CreatedKey; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(created.api_key);
      setCopied(true);
      toast.success('API key copied to clipboard.');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2.5 border border-amber-400/40 bg-amber-500/10 px-3 py-2.5 text-amber-200">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p className="text-xs leading-relaxed">
          Copy this key now — you won't be able to see it again. Store it somewhere safe; if you
          lose it you'll need to revoke this key and generate a new one.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          {created.label}
        </span>
        <div className="flex items-center gap-2 border border-outline bg-card p-3">
          <code className="flex-1 break-all font-mono text-xs text-zinc-100">
            {created.api_key}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="shrink-0 gap-1.5"
            aria-label="Copy API key"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-success" /> Copied
              </>
            ) : (
              <>
                <Copy className="size-3.5" /> Copy
              </>
            )}
          </Button>
        </div>
      </div>

      <Button size="lg" className="w-full" onClick={onDone}>
        Done — I've saved my key
      </Button>
    </div>
  );
}
