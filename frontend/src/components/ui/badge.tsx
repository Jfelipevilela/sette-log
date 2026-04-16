import { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "green" | "amber" | "red" | "cyan" | "neutral" | "blue";
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold shadow-sm",
        tone === "green" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "amber" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "red" && "border-red-200 bg-red-50 text-red-800",
        tone === "cyan" && "border-cyan-200 bg-cyan-50 text-cyan-800",
        tone === "neutral" && "border-zinc-200 bg-zinc-50 text-zinc-700",
        className,
      )}
      {...props}
    />
  );
}
