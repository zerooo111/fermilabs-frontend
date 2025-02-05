import React from 'react';

import { Copy } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  textToCopy?: string;
  children: React.ReactNode;
  className?: string;
};

type CopyIconProps = {
  className?: string;
};

export const copyToClipboard = async (textToCopy: string = '') => {
  return await navigator.clipboard.writeText(textToCopy);
};

const Copyable = ({ textToCopy, children, className }: Props) => {
  const handleCopy = async () => {
    await copyToClipboard(textToCopy).then(() => toast.success('Copied to clipboard!'));
  };
  return (
    <div className={`cursor-pointer ${className}`} onClick={handleCopy}>
      {children}
    </div>
  );
};

export default Copyable;

Copyable.Icon = function CopyIcon({ className }: CopyIconProps) {
  return <Copy className={className} />;
};

const CopyableText = ({ textToCopy, className }: { textToCopy: string; className?: string }) => {
  return (
    <Copyable textToCopy={textToCopy}>
      <span className={`flex gap-1.5  items-center` + className}>
        {textToCopy}
        <Copyable.Icon />
      </span>
    </Copyable>
  );
};

export { CopyableText };
