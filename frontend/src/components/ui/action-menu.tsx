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
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-50",
        danger ? "text-red-700 hover:bg-red-50" : "text-fleet-ink",
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
    const left = Math.min(
      Math.max(8, rect.right - width),
      window.innerWidth - width - 8,
    );
    setPosition({
      top: rect.bottom + 8,
      left,
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
        className="flex h-9 w-9 items-center justify-center rounded-md border border-fleet-line bg-white text-fleet-ink shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-fleet-green"
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
            className="fixed z-[9999] min-w-48 rounded-lg border border-fleet-line bg-white p-1 shadow-2xl"
            style={{ top: position.top, left: position.left }}
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
