import { MoreHorizontal } from "lucide-react";
import {
  ButtonHTMLAttributes,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

type ActionMenuItem = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
};

type ActionMenuProps = {
  items: ActionMenuItem[];
};

type MenuPosition = {
  top: number;
  left: number;
  maxHeight?: number;
};

function MenuButton({
  danger,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50",
        danger ? "text-red-700 hover:bg-red-50" : "text-fleet-ink hover:bg-emerald-50/70 hover:text-fleet-green",
        className,
      )}
      {...props}
    />
  );
}

export function ActionMenu({ items }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function updatePosition() {
    const button = buttonRef.current;
    if (!button) {
      return;
    }
    const rect = button.getBoundingClientRect();
    const width = 192;
    const estimatedMenuHeight = Math.max(56, items.length * 44 + 12);
    const left = Math.min(
      Math.max(8, rect.right - width),
      window.innerWidth - width - 8,
    );
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUpwards =
      spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;

    setPosition({
      top: openUpwards
        ? Math.max(8, rect.top - estimatedMenuHeight - 8)
        : rect.bottom + 8,
      left,
      maxHeight: Math.max(120, openUpwards ? spaceAbove : spaceBelow),
    });
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    updatePosition();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-fleet-ink shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition hover:-translate-y-px hover:border-emerald-200 hover:bg-emerald-50/45 focus:outline-none focus:ring-2 focus:ring-fleet-green"
        aria-label="Abrir acoes"
        aria-expanded={open}
        onClick={() => {
          updatePosition();
          setOpen((current) => !current);
        }}
      >
        <MoreHorizontal size={18} />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] min-w-48 overflow-y-auto rounded-lg border border-white/80 bg-white/95 p-1.5 shadow-[0_22px_60px_rgba(15,23,42,0.20)] ring-1 ring-slate-200/80 backdrop-blur-xl"
            style={{
              top: position.top,
              left: position.left,
              maxHeight: position.maxHeight,
            }}
          >
            {items.map((item) => (
              <MenuButton
                key={item.label}
                danger={item.danger}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.icon}
                {item.label}
              </MenuButton>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
