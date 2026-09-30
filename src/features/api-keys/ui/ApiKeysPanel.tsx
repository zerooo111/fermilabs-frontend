/**
 * API Keys panel — header-mounted dialog (mirrors FeeCreditDialog) that lets a
 * whitelisted wallet list, generate, and revoke its own API keys.
 *
 * Auth reuses the access-gate session token via `useApiKeys`; the trigger only
 * renders alongside the rest of the authenticated header, but the dialog body
 * still fails gently (empty state) if the wallet isn't authorized.
 */
import { useState } from 'react';
import { AlertTriangle, Check, Copy, Gauge, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/lib/utils';

import { useApiKeys } from '../model/useApiKeys';
import { MAX_ACTIVE_KEYS } from '../model/apiKeysAtoms';
import type { ApiKeyView, CreatedKey } from '../api/keysClient';

// Support channel for limit-increase requests (kept in sync with LINKS.DISCORD).
const DISCORD_URL = 'https://discord.gg/kNcktKSk7u';

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

/** Small label set in the mono/uppercase treatment used across the trade UI. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-fg-tertiary">
      {children}
    </span>
  );
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
              <span className="font-sans text-xs text-fg-secondary">API Keys</span>
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="font-sans text-xs">
          Manage API keys for programmatic access
        </TooltipContent>
      </Tooltip>

      <DialogContent className="max-w-lg gap-5 p-6">
        <DialogHeader className="gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center border border-line bg-surface-raised text-fg-primary">
              <KeyRound className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-lg font-semibold tracking-tight">API Keys</DialogTitle>
              <DialogDescription className="text-sm leading-snug text-fg-secondary">
                Programmatic access for the connected wallet. Up to {MAX_ACTIVE_KEYS} active keys.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!authorized ? (
          // Gentle empty state for non-whitelisted / signed-out wallets.
          <div className="flex flex-col items-center gap-3 border border-line bg-surface-raised px-4 py-10 text-center">
            <div className="flex size-10 items-center justify-center border border-line bg-surface-sunken text-fg-tertiary">
              <KeyRound className="size-5" />
            </div>
            <p className="max-w-[18rem] text-sm leading-relaxed text-fg-secondary">
              Redeem an invite and connect your wallet to manage API keys.
            </p>
          </div>
        ) : createdSecret ? (
          <CreatedSecretView created={createdSecret} onDone={dismissSecret} />
        ) : (
          <div className="flex flex-col gap-5">
            {/* Generate card */}
            <div className="flex flex-col gap-3 border border-line bg-surface-raised p-4">
              <FieldLabel>New key label</FieldLabel>
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
              {/* Segmented usage indicator — one tick per allowed active key. */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: MAX_ACTIVE_KEYS }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-1 w-6 transition-colors',
                        i < activeCount
                          ? atLimit
                            ? 'bg-warning-solid'
                            : 'bg-fg-primary'
                          : 'bg-line'
                      )}
                    />
                  ))}
                </div>
                <span className="font-mono text-[11px] tabular-nums text-fg-tertiary">
                  {activeCount}/{MAX_ACTIVE_KEYS} active
                </span>
              </div>
            </div>

            {error && (
              <p className="border border-negative-line bg-negative-muted px-3 py-2 text-xs text-negative-fg">
                {error}
              </p>
            )}

            {/* Keys list */}
            <div className="flex flex-col gap-2.5">
              <FieldLabel>Your keys</FieldLabel>
              {loading && keys.length === 0 ? (
                <div className="flex items-center justify-center gap-2 border border-line bg-surface-raised py-10 text-sm text-fg-secondary">
                  <Loader2 className="size-4 animate-spin" /> Loading keys…
                </div>
              ) : keys.length === 0 ? (
                <p className="border border-line bg-surface-raised px-4 py-8 text-center text-sm text-fg-secondary">
                  No API keys yet. Generate one above to get started.
                </p>
              ) : (
                <div className="flex max-h-[280px] flex-col gap-2 overflow-y-auto pr-0.5">
                  {keys.map(k => (
                    <KeyRowItem
                      key={k.id}
                      row={k}
                      confirming={confirmRevokeId === k.id}
                      revoking={revokingId === k.id}
                      onRequestRevoke={() => setConfirmRevokeId(k.id)}
                      onCancelRevoke={() => setConfirmRevokeId(null)}
                      onConfirmRevoke={() => handleRevoke(k.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            <RateLimitsNote />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Standard-tier limits applied to self-serve keys. These mirror what the
 * gateway actually enforces (token-bucket rate limit + concurrent connection
 * cap), shown so users can size their integration before they hit a 429.
 */
function RateLimitsNote() {
  return (
    <div className="flex flex-col gap-2.5 border border-line bg-surface-raised p-4">
      <div className="flex items-center gap-2">
        <Gauge className="size-3.5 text-fg-tertiary" />
        <FieldLabel>Rate limits · Standard tier</FieldLabel>
      </div>
      <dl className="flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-fg-tertiary">Requests</dt>
          <dd className="font-mono tabular-nums text-fg-primary">
            200<span className="text-fg-tertiary"> req/s</span> · burst 400
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-fg-tertiary">Concurrent connections</dt>
          <dd className="font-mono tabular-nums text-fg-primary">5</dd>
        </div>
      </dl>
      <p className="text-[11px] leading-relaxed text-fg-tertiary">
        Sustained 200 req/s with bursts up to 400 (token bucket). Exceeding the limits returns 429 —
        back off and retry.
      </p>
      <p className="border-t border-line-subtle pt-2.5 text-[11px] leading-relaxed text-fg-tertiary">
        Need higher limits?{' '}
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-fg-secondary underline underline-offset-2 outline-none transition-colors hover:text-fg-primary focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          Reach out on Discord
        </a>
        .
      </p>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span
        className={cn('size-1.5 rounded-full', active ? 'bg-positive-solid' : 'bg-fg-disabled')}
      />
      <span
        className={cn(
          'font-mono text-[10px] uppercase tracking-[0.12em]',
          active ? 'text-positive-fg' : 'text-fg-disabled'
        )}
      >
        {active ? 'Active' : 'Revoked'}
      </span>
    </span>
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
        'group flex flex-col gap-2.5 border border-line bg-surface-raised p-3 transition-colors',
        row.active && 'hover:border-line-strong'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'truncate text-sm font-medium',
            row.active ? 'text-fg-primary' : 'text-fg-disabled'
          )}
        >
          {row.label}
        </span>
        <StatusPill active={row.active} />
      </div>

      {/* Redacted: the raw secret is shown only once, at create time. */}
      <code
        className={cn(
          'truncate font-mono text-xs tracking-wider',
          row.active ? 'text-fg-tertiary' : 'text-fg-disabled'
        )}
      >
        {maskHint(row.key_hint)}
      </code>

      <div className="flex min-h-7 items-center justify-between gap-2">
        <div
          className={cn(
            'flex items-center gap-2 font-mono text-[11px]',
            row.active ? 'text-fg-tertiary' : 'text-fg-disabled'
          )}
        >
          <span>Created {formatDate(row.created_at)}</span>
          <span className="size-0.5 rounded-full bg-fg-disabled" aria-hidden />
          <span className="tabular-nums">{row.max_connections} conn</span>
        </div>

        {row.active &&
          (confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-fg-secondary">Revoke?</span>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={onRequestRevoke}
              className="gap-1.5 text-fg-tertiary transition-colors hover:text-negative-fg group-hover:text-fg-secondary"
            >
              <Trash2 className="size-3.5" />
              Revoke
            </Button>
          ))}
      </div>
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
      <div className="flex items-start gap-2.5 border border-warning-line bg-warning-muted px-3 py-2.5 text-warning-fg">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p className="text-xs leading-relaxed">
          Copy this key now — you won't be able to see it again. Store it somewhere safe; if you
          lose it you'll need to revoke this key and generate a new one.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <FieldLabel>{created.label}</FieldLabel>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-warning-fg">
            Shown once
          </span>
        </div>
        <div className="border border-line bg-surface-sunken p-3">
          <code className="block break-all font-mono text-xs leading-relaxed text-fg-primary">
            {created.api_key}
          </code>
          <div className="mt-3 flex justify-end border-t border-line-subtle pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5"
              aria-label="Copy API key"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-positive-fg" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" /> Copy key
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <Button size="lg" className="w-full" onClick={onDone}>
        Done — I've saved my key
      </Button>
    </div>
  );
}
