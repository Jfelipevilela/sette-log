import { SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'h-10 w-full rounded-md border border-fleet-line bg-white px-3 text-sm outline-none transition focus:border-fleet-green focus:ring-2 focus:ring-emerald-100',
          className
        )}
        {...props}
      />
    );
  }
);

Select.displayName = 'Select';
