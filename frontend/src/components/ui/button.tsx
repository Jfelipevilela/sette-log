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
          variant === 'primary' && 'bg-fleet-green text-white hover:bg-emerald-700',
          variant === 'secondary' && 'border border-fleet-line bg-white text-fleet-ink hover:bg-zinc-50',
          variant === 'ghost' && 'text-zinc-700 hover:bg-zinc-100',
          variant === 'danger' && 'bg-fleet-red text-white hover:bg-red-700',
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
