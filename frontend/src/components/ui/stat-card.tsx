import { LucideIcon } from 'lucide-react';
import { Card } from './card';

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: 'green' | 'cyan' | 'amber' | 'red';
};

const toneClasses = {
  green: 'bg-emerald-50 text-emerald-700',
  cyan: 'bg-cyan-50 text-cyan-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700'
};

export function StatCard({ label, value, detail, icon: Icon, tone }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">{label}</p>
          <strong className="mt-2 block text-3xl font-semibold text-fleet-ink">{value}</strong>
          <span className="mt-2 block text-sm text-zinc-500">{detail}</span>
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
          <Icon size={22} aria-hidden="true" />
        </span>
      </div>
    </Card>
  );
}
