import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, Filter } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

export function FilterPanel({
  title = "Filtros",
  description,
  children,
  className,
  searchSlot,
  expandedContent,
  isExpanded,
  onToggleExpanded,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  searchSlot?: ReactNode;
  expandedContent?: ReactNode;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}) {
  const useCompactLayout =
    searchSlot !== undefined &&
    expandedContent !== undefined &&
    isExpanded !== undefined &&
    onToggleExpanded !== undefined;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="border-b border-fleet-line bg-gradient-to-r from-zinc-50 via-white to-emerald-50/60">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
            <Filter size={18} />
          </span>
          <div>
            <CardTitle>{title}</CardTitle>
            {description && (
              <p className="mt-1 text-sm text-zinc-500">{description}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-5">
        {useCompactLayout ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="min-w-0 flex-1">{searchSlot}</div>
              <Button
                type="button"
                variant="secondary"
                className="shrink-0"
                onClick={onToggleExpanded}
              >
                <Filter size={18} />
                {isExpanded ? "Ocultar filtros" : "Expandir filtros"}
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </Button>
            </div>
            {isExpanded ? expandedContent : null}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("space-y-2 text-sm font-medium text-fleet-ink", className)}>
      <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}
