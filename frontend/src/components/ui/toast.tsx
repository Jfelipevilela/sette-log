import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { TOAST_EVENT, ToastPayload } from "../../lib/toast";

type ToastItem = ToastPayload & {
  id: number;
};

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    function handleToast(event: Event) {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      const id = Date.now() + Math.random();
      setItems((current) => [...current, { id, tone: "success", ...detail }]);
      window.setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== id));
      }, 4200);
    }

    window.addEventListener(TOAST_EVENT, handleToast);
    return () => window.removeEventListener(TOAST_EVENT, handleToast);
  }, []);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-[10000] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      {items.map((item) => {
        const tone = item.tone ?? "success";
        const Icon = icons[tone];
        return (
          <div
            key={item.id}
            className={cn(
              "rounded-lg border bg-white p-4 shadow-2xl",
              tone === "success" && "border-emerald-200",
              tone === "error" && "border-red-200",
              tone === "info" && "border-cyan-200",
            )}
          >
            <div className="flex items-start gap-3">
              <Icon
                size={18}
                className={cn(
                  "mt-0.5 shrink-0",
                  tone === "success" && "text-fleet-green",
                  tone === "error" && "text-fleet-red",
                  tone === "info" && "text-fleet-cyan",
                )}
              />
              <div className="min-w-0 flex-1">
                <strong className="block text-sm text-fleet-ink">
                  {item.title}
                </strong>
                {item.description && (
                  <p className="mt-1 text-sm text-zinc-500">
                    {item.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="Fechar notificação"
                onClick={() =>
                  setItems((current) =>
                    current.filter((currentItem) => currentItem.id !== item.id),
                  )
                }
              >
                <X size={15} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
