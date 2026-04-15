import { Bike, Bus, Car, Package, Truck, Wrench, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

const vehicleTypeConfig: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  car: { label: 'Automovel', icon: Car, tone: 'bg-emerald-50 text-emerald-700' },
  van: { label: 'Van', icon: Package, tone: 'bg-cyan-50 text-cyan-700' },
  truck: { label: 'Caminhao', icon: Truck, tone: 'bg-amber-50 text-amber-700' },
  bus: { label: 'Onibus', icon: Bus, tone: 'bg-sky-50 text-sky-700' },
  motorcycle: { label: 'Moto', icon: Bike, tone: 'bg-rose-50 text-rose-700' },
  equipment: { label: 'Equipamento', icon: Wrench, tone: 'bg-zinc-100 text-zinc-700' }
};

export function vehicleTypeLabel(type?: string) {
  return vehicleTypeConfig[type ?? '']?.label ?? type ?? 'Veiculo';
}

type VehicleTypeIconProps = {
  type?: string;
  className?: string;
  showLabel?: boolean;
};

export function VehicleTypeIcon({ type, className, showLabel = false }: VehicleTypeIconProps) {
  const config = vehicleTypeConfig[type ?? ''] ?? { label: vehicleTypeLabel(type), icon: Car, tone: 'bg-zinc-100 text-zinc-700' };
  const Icon = config.icon;

  return (
    <span className={cn('inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold', config.tone, className)}>
      <Icon size={16} strokeWidth={2.2} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
