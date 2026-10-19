/**
 * Address input that opens /points?wallet=. Anyone can check any address;
 * a connected wallet gets a one-click shortcut.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { cn } from '@/shared/lib/utils';
import { isValidAddress, shortAddress, walletPointsPath } from '../model/format';

export function AddressChecker({
  initial = '',
  className,
}: {
  initial?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const connected = useWallet().publicKey?.toBase58();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const open = (address: string) => navigate(walletPointsPath(address));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const address = value.trim();
    if (!isValidAddress(address)) {
      setError("That doesn't look like a Solana address.");
      return;
    }
    setError(null);
    open(address);
  };

  return (
    <div className={className}>
      <form onSubmit={submit} className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row">
        <label htmlFor="points-address" className="sr-only">
          Wallet address
        </label>
        <input
          id="points-address"
          value={value}
          onChange={e => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Paste a Solana wallet address"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? 'points-address-error' : undefined}
          className={cn(
            'h-12 w-full min-w-0 border bg-surface-sunken px-4 font-mono text-sm text-rock caret-amber-200 transition-colors duration-150 placeholder:font-sans placeholder:text-rock/40 sm:flex-1',
            error ? 'border-danger' : 'border-rock/25 hover:border-rock/40 focus:border-amber-200'
          )}
          // The amber border is the focus state, so the field drops the page's
          // offset outline (inline, to win over `.landing :focus-visible`).
          style={{ outline: 'none' }}
        />
        <button
          type="submit"
          className="h-12 shrink-0 bg-amber-200 px-5 font-medium text-dark-forest transition-colors duration-150 hover:bg-amber-100"
        >
          Check points
        </button>
      </form>
      <div className="mt-2 min-h-5 text-sm">
        {error ? (
          <p id="points-address-error" className="text-danger">
            {error}
          </p>
        ) : (
          connected && (
            <button type="button" onClick={() => open(connected)} className="link text-rock/70">
              Check my wallet ({shortAddress(connected)})
            </button>
          )
        )}
      </div>
    </div>
  );
}
