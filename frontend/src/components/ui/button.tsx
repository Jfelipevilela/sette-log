import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-fleet-green focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          size === 'sm' ? 'h-9 px-3 text-sm' : 'h-10 px-4 text-sm',
          variant === 'primary' && 'bg-gradient-to-b from-emerald-600 to-fleet-green text-white shadow-[0_10px_24px_rgba(15,143,99,0.22)] hover:-translate-y-px hover:from-emerald-500 hover:to-emerald-700 active:translate-y-0',
          variant === 'secondary' && 'border border-slate-200 bg-white/95 text-fleet-ink shadow-[0_8px_20px_rgba(15,23,42,0.06)] hover:-translate-y-px hover:border-emerald-200 hover:bg-emerald-50/35 active:translate-y-0',
          variant === 'ghost' && 'text-zinc-700 hover:bg-emerald-50 hover:text-fleet-green',
          variant === 'danger' && 'bg-gradient-to-b from-red-600 to-fleet-red text-white shadow-[0_10px_24px_rgba(194,65,59,0.22)] hover:-translate-y-px hover:from-red-500 hover:to-red-700 active:translate-y-0',
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
