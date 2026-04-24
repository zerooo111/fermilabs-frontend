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
    { duration: Infinity }
  );
}
