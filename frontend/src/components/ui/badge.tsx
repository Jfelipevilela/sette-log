import { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "green" | "amber" | "red" | "cyan" | "neutral" | "blue";
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold shadow-[0_6px_16px_rgba(15,23,42,0.05)] ring-1 ring-white/70",
        tone === "green" && "border-emerald-200 bg-gradient-to-b from-emerald-50 to-white text-emerald-800",
        tone === "amber" && "border-amber-200 bg-gradient-to-b from-amber-50 to-white text-amber-800",
        tone === "red" && "border-red-200 bg-gradient-to-b from-red-50 to-white text-red-800",
        tone === "cyan" && "border-cyan-200 bg-gradient-to-b from-cyan-50 to-white text-cyan-800",
        tone === "blue" && "border-sky-200 bg-gradient-to-b from-sky-50 to-white text-sky-800",
        tone === "neutral" && "border-slate-200 bg-gradient-to-b from-slate-50 to-white text-slate-700",
        className,
      )}
      {...props}
    />
  );
}
