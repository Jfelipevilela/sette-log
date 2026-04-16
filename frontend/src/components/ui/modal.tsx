import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'md' | 'xl';
  onClose: () => void;
};

export function Modal({ open, title, description, children, size = 'md', onClose }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-fleet-ink/55 p-4 backdrop-blur-sm">
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-lg border border-white/70 bg-white shadow-soft ring-1 ring-fleet-line/70 ${size === 'xl' ? 'max-w-5xl' : 'max-w-2xl'}`}>
        <div className="flex items-start justify-between gap-4 border-b border-fleet-line bg-zinc-50/80 p-5">
          <div>
            <h2 className="text-lg font-semibold text-fleet-ink">{title}</h2>
            {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
