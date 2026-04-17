import { HTMLAttributes } from 'react';
import { LucideIcon } from 'lucide-react';
import { Card } from './card';

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: 'green' | 'cyan' | 'amber' | 'red';
} & HTMLAttributes<HTMLDivElement>;

const toneClasses = {
  green: {
    icon: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    accent: 'from-emerald-500 to-emerald-300',
    glow: ''
  },
  cyan: {
    icon: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
    accent: 'from-cyan-500 to-cyan-300',
    glow: ''
  },
  amber: {
    icon: 'bg-amber-50 text-amber-700 ring-amber-100',
    accent: 'from-amber-500 to-amber-300',
    glow: ''
  },
  red: {
    icon: 'bg-red-50 text-red-700 ring-red-100',
    accent: 'from-red-500 to-red-300',
    glow: ''
  }
};

export function StatCard({ label, value, detail, icon: Icon, tone, className, ...props }: StatCardProps) {
  const styles = toneClasses[tone];

  return (
    <Card className={`group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 ${className ?? ''}`} {...props}>
      <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${styles.accent}`} />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
          <strong className="mt-2 block truncate text-2xl font-semibold text-fleet-ink xl:text-3xl">{value}</strong>
          <span className="mt-2 block text-sm leading-5 text-zinc-500">{detail}</span>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ${styles.icon}`}>
          <Icon size={22} aria-hidden="true" />
        </span>
      </div>
    </Card>
  );
}
