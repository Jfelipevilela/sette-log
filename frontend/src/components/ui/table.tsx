import { HTMLAttributes, TableHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-separate border-spacing-0 text-left text-sm', className)} {...props} />;
}

export function Th({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('border-b border-slate-200 bg-slate-50/90 px-4 py-3 text-xs font-semibold uppercase text-slate-500 first:rounded-tl-lg last:rounded-tr-lg', className)} {...props} />;
}

export function Td({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-b border-slate-100 px-4 py-3 align-middle text-zinc-800 transition-colors group-hover:bg-emerald-50/25', className)} {...props} />;
}
