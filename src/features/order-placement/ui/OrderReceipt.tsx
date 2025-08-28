import { OrderReceipt as OrderReceiptType, getTxExplorerUrl } from '@/entities/order-receipt';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { ReceiptText, ExternalLink } from 'lucide-react';

interface OrderReceiptProps {
  receipt: OrderReceiptType;
}

export function OrderReceipt({ receipt }: OrderReceiptProps) {
  const txExplorerUrl = getTxExplorerUrl(receipt.tx_hash);

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
            <span className="text-sm font-medium">Sequence Number:</span>
            <span className="text-sm font-mono">{receipt.sequence_number}</span>
          </div>
          {/* <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Expected Tick:</span>
            <a
              href={tickExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm font-mono text-blue-500 hover:text-blue-600"
            >
              {receipt.expected_tick}
              <ExternalLink className="size-3" />
            </a>
          </div> */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Transaction:</span>
            <a
              href={txExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm font-mono text-blue-500 hover:text-blue-600 truncate max-w-[200px]"
            >
              {receipt.tx_hash.slice(0, 8)}
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
