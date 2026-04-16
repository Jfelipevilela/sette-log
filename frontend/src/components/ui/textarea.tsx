import { TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'min-h-24 w-full rounded-md border border-fleet-line bg-white/95 px-3 py-2 text-sm text-fleet-ink shadow-sm outline-none transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-fleet-green focus:bg-white focus:ring-2 focus:ring-emerald-100',
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
