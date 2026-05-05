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
        <div className="px-6 pt-6 pb-4 border-b border-outline text-center space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Welcome to Fermi</h2>
          <p className="text-sm text-muted-foreground">
            Deposit USDC to unlock trading — it only takes a moment.
          </p>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 space-y-3">
          {STEPS.map(step => (
            <div
              key={step.n}
              className={`flex items-center gap-4 p-3 rounded-lg border transition-opacity ${
                step.active
                  ? 'border-outline bg-muted/20'
                  : 'border-outline/40 bg-transparent opacity-50'
              }`}
            >
              <div
                className={`size-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  step.active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                }`}
              >
                {step.n}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
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
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            Skip for now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
