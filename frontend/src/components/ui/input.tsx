import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'h-10 w-full rounded-md border border-fleet-line bg-white/95 px-3 text-sm text-fleet-ink shadow-sm outline-none transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-fleet-green focus:bg-white focus:ring-2 focus:ring-emerald-100',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
