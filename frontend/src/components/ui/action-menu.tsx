import { MoreHorizontal } from "lucide-react";
import { ButtonHTMLAttributes, ReactNode } from "react";
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
  align?: "left" | "right";
};

function closeMenu(event: React.MouseEvent<HTMLButtonElement>) {
  const details = event.currentTarget.closest("details");
  if (details) {
    details.removeAttribute("open");
  }
}

function MenuButton({
  danger,
  className,
  onClick,
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
      onClick={(event) => {
        closeMenu(event);
        onClick?.(event);
      }}
      {...props}
    />
  );
}

export function ActionMenu({ items, align = "right" }: ActionMenuProps) {
  return (
    <details className="group relative inline-block text-left">
      <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-fleet-line bg-white text-fleet-ink shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-fleet-green [&::-webkit-details-marker]:hidden">
        <MoreHorizontal size={18} />
        <span className="sr-only">Abrir acoes</span>
      </summary>
      <div
        className={cn(
          "absolute z-30 mt-2 min-w-44 rounded-lg border border-fleet-line bg-white p-1 shadow-xl",
          align === "right" ? "right-0" : "left-0",
        )}
      >
        {items.map((item) => (
          <MenuButton
            key={item.label}
            danger={item.danger}
            disabled={item.disabled}
            onClick={item.onClick}
          >
            {item.icon}
            {item.label}
          </MenuButton>
        ))}
      </div>
    </details>
  );
}
