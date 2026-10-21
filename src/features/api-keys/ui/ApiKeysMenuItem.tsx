/** Account-menu entry that opens the API keys dialog. */
import { useSetAtom } from 'jotai';
import { KeyRound } from 'lucide-react';
import { DropdownMenuItem } from '@/shared/ui/dropdown-menu';
import { apiKeysDialogOpenAtom } from '../model/apiKeysAtoms';

export function ApiKeysMenuItem() {
  const setOpen = useSetAtom(apiKeysDialogOpenAtom);
  return (
    <DropdownMenuItem onSelect={() => setOpen(true)} className="text-xs">
      <KeyRound className="size-3.5" />
      API keys
    </DropdownMenuItem>
  );
}
