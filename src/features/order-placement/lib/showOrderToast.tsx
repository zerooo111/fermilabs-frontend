import { toast } from 'sonner';
import { OrderToast } from '@/features/order-placement/ui/OrderToast';

export function showOrderToast(title: string, txSignature?: string, acceptedLatencyMs?: number) {
  toast.custom(
    id => (
      <OrderToast
        toastId={id}
        title={title}
        txSignature={txSignature}
        acceptedLatencyMs={acceptedLatencyMs}
      />
    ),
    {
      duration: 10_000,
      unstyled: true,
      style: { padding: 0, background: 'transparent', border: 'none' },
    }
  );
}
