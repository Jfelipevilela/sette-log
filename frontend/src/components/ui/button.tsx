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
          'inline-flex items-center justify-center rounded-md font-medium transition focus:outline-none focus:ring-2 focus:ring-fleet-green disabled:pointer-events-none disabled:opacity-50',
          size === 'sm' ? 'h-9 px-3 text-sm' : 'h-10 px-4 text-sm',
          variant === 'primary' && 'bg-gradient-to-b from-fleet-green to-emerald-700 text-white shadow-sm shadow-emerald-900/15 hover:from-emerald-600 hover:to-emerald-800',
          variant === 'secondary' && 'border border-fleet-line bg-white/90 text-fleet-ink shadow-sm hover:border-zinc-300 hover:bg-zinc-50',
          variant === 'ghost' && 'text-zinc-700 hover:bg-zinc-100/80',
          variant === 'danger' && 'bg-gradient-to-b from-fleet-red to-red-700 text-white shadow-sm shadow-red-900/15 hover:from-red-600 hover:to-red-800',
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
