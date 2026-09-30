/**
 * OnboardingModal — shown once to first-time users (zero balance) to
 * guide them towards depositing before they can trade.
 */
import { ArrowRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent } from '@/shared/ui/dialog';

interface Props {
  open: boolean;
  onDeposit: () => void;
  onDismiss: () => void;
}

const STEPS = [
  {
    n: 1,
    title: 'Deposit USDC',
    description: 'Add collateral to your margin account',
    active: true,
  },
  {
    n: 2,
    title: 'Place your first trade',
    description: 'Go long or short on any perpetual market',
    active: false,
  },
];

export function OnboardingModal({ open, onDeposit, onDismiss }: Props) {
  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onDismiss()}>
      <DialogContent className="max-w-sm gap-0 p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-line-subtle text-center space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Welcome to Fermi</h2>
          <p className="text-sm text-fg-secondary">
            Deposit USDC to unlock trading — it only takes a moment.
          </p>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 space-y-3">
          {STEPS.map(step => (
            <div
              key={step.n}
              className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                step.active
                  ? 'border-line-strong bg-surface-raised'
                  : 'border-line-subtle bg-transparent text-fg-disabled'
              }`}
            >
              <div
                className={`size-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  step.active
                    ? 'bg-surface-inverse text-fg-inverse'
                    : 'bg-surface-overlay text-fg-tertiary'
                }`}
              >
                {step.n}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{step.title}</p>
                <p className={`text-xs mt-0.5 ${step.active ? 'text-fg-tertiary' : ''}`}>
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-2">
          <Button className="w-full gap-2" onClick={onDeposit}>
            Deposit USDC
            <ArrowRight className="size-4" />
          </Button>
          <button
            onClick={onDismiss}
            className="w-full text-xs text-fg-tertiary hover:text-fg-primary transition-colors py-1 outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            Skip for now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
