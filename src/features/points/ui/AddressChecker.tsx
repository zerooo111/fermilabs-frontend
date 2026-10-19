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
      <form
        onSubmit={submit}
        className={cn(
          'flex w-full max-w-2xl items-center gap-2 rounded-2xl border bg-surface-sunken p-1.5 transition-[border-color,box-shadow] duration-150',
          'focus-within:shadow-[0_0_0_4px_rgb(180_220_120/0.14),0_0_32px_rgb(180_220_120/0.12)]',
          error ? 'border-danger' : 'border-rock/15 focus-within:border-lichen/70'
        )}
      >
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
          className="h-11 w-full min-w-0 flex-1 bg-transparent px-3 font-mono text-sm text-rock caret-lichen placeholder:font-sans placeholder:text-rock/40"
          // The form glows on focus, so the field drops the page's focus outline
          // (inline, to win over `.landing :focus-visible`).
          style={{ outline: 'none' }}
        />
        <button
          type="submit"
          className="h-11 shrink-0 rounded-xl bg-amber-200 px-5 text-sm font-medium text-dark-forest transition-colors duration-150 hover:bg-amber-100"
        >
          Check points
        </button>
      </form>
      <div className="mt-2 min-h-5 px-1 text-sm">
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
