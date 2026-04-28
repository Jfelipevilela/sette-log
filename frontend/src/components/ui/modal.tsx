import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "md" | "xl";
  onClose: () => void;
};

export function Modal({
  open,
  title,
  description,
  children,
  size = "md",
  onClose,
}: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-2 backdrop-blur-md sm:items-center sm:p-4 "
      onMouseDown={onClose}
    >
      <div
        className={`h-[calc(100dvh-0.5rem)] w-full overflow-hidden rounded-t-xl border border-white/80 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/80 sm:h-auto sm:max-h-[92vh] sm:rounded-lg ${size === "xl" ? "max-w-5xl" : "max-w-2xl"}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="relative flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-white via-emerald-50/45 to-cyan-50/45 p-4 sm:p-5 ">
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fleet-green via-fleet-cyan to-fleet-amber" />
          <div className="min-w-0 pt-1">
            <h2 className="text-lg font-semibold text-fleet-ink">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-zinc-500">{description}</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 shrink-0 p-0"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={18} />
          </Button>
        </div>
        <div className="max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:max-h-[calc(92vh-5.25rem)] sm:p-5 overflow-x-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
