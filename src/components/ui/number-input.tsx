import * as React from 'react';
import { NumericFormat, NumericFormatProps } from 'react-number-format';
import { Input } from './input';
import { Label } from './label';
import { cn } from '@/lib/utils';

export interface NumberInputProps extends Omit<NumericFormatProps, 'customInput'> {
  name?: string;
  label?: string;
  unit?: string;
  error?: string;
  className?: string;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ label, unit, error, className, name, ...props }, ref) => {
    return (
      <div className={cn('relative', className)}>
        {label && <Label className="text-sm text-neutral-500" htmlFor={name}>{label}</Label>}
        <NumericFormat
          id={name}
          name={name}
          customInput={Input}
          className="tabular-nums"
          allowedDecimalSeparators={['.']}
          thousandSeparator=","
          allowNegative={false}
          {...props}
          getInputRef={ref}
        />
        {unit && (
          <span className="absolute text-gray-500 right-2.5 text-xs font-medium bottom-2.5">
            {' '}
            {unit}{' '}
          </span>
        )}
        {error && <span className="text-red-500 text-xs mt-1">{error}</span>}
      </div>
    );
  }
);

NumberInput.displayName = 'NumberInput';

export { NumberInput };
