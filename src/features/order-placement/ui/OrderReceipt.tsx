import { OrderReceipt as OrderReceiptType } from '@/entities/order-receipt';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { ReceiptText, ExternalLink } from 'lucide-react';

interface OrderReceiptProps {
  receipt: OrderReceiptType;
}

export function OrderReceipt({ receipt }: OrderReceiptProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="icon" className="size-8">
          <ReceiptText className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Order ID:</span>
            <span className="text-sm font-mono">{receipt.orderId}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <span className="text-sm capitalize">{receipt.status}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Timestamp:</span>
            <span className="text-sm">{new Date(receipt.timestamp).toLocaleString()}</span>
          </div>
          {receipt.signature && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Signature:</span>
              {receipt.explorerUrl ? (
                <a
                  href={receipt.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm font-mono text-blue-500 hover:text-blue-600 truncate max-w-[200px]"
                >
                  {receipt.signature.slice(0, 8)}...{receipt.signature.slice(-8)}
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                <span className="text-sm font-mono truncate max-w-[200px]">
                  {receipt.signature}
                </span>
              )}
            </div>
          )}
          {receipt.txHash && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Transaction:</span>
              <span className="text-sm font-mono truncate max-w-[200px]">{receipt.txHash}</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
