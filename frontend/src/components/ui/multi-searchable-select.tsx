import { MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "../../lib/utils";
import type { SearchableSelectOption } from "./searchable-select";

type MultiSearchableSelectProps = {
  name?: string;
  value?: string[];
  defaultValue?: string[];
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  searchable?: boolean;
  className?: string;
  onValueChange?: (value: string[]) => void;
};

export function MultiSearchableSelect({
  name,
  value,
  defaultValue = [],
  options,
  placeholder = "Selecione",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum resultado encontrado.",
  disabled,
  searchable = true,
  className,
  onValueChange,
}: MultiSearchableSelectProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [internalValue, setInternalValue] = useState<string[]>(defaultValue);
  const [dropdownRect, setDropdownRect] = useState({
    left: 0,
    top: 0,
    width: 0,
    maxHeight: 256,
  });

  const selectedValues = value ?? internalValue;
  const selectedOptions = options.filter((option) =>
    selectedValues.includes(option.value),
  );

  useEffect(() => {
    if (value === undefined) {
      setInternalValue(defaultValue);
    }
  }, [defaultValue, value]);

  useEffect(() => {
    function handlePointerDown(event: globalThis.MouseEvent) {
      const target = event.target as Node;
      if (
        !wrapperRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function updateDropdownPosition() {
      const trigger = wrapperRef.current?.getBoundingClientRect();
      if (!trigger) {
        return;
      }

      const margin = 8;
      const viewportGap = 12;
      const availableBelow = window.innerHeight - trigger.bottom - viewportGap;
      const availableAbove = trigger.top - viewportGap;
      const preferredHeight = 288;
      const openAbove =
        availableBelow < 180 && availableAbove > availableBelow;
      const maxHeight = Math.max(
        160,
        Math.min(
          preferredHeight,
          openAbove ? availableAbove - margin : availableBelow - margin,
        ),
      );

      setDropdownRect({
        left: Math.max(
          viewportGap,
          Math.min(trigger.left, window.innerWidth - trigger.width - viewportGap),
        ),
        top: openAbove ? trigger.top - maxHeight - margin : trigger.bottom + margin,
        width: trigger.width,
        maxHeight,
      });
    }

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [open]);

  const filteredOptions = useMemo(() => {
    if (!searchable) {
      return options;
    }
    const term = query.trim().toLowerCase();
    if (!term) {
      return options;
    }
    return options.filter((option) =>
      [option.label, option.searchText, option.value]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(term)),
    );
  }, [options, query, searchable]);

  function updateValue(nextValue: string[]) {
    if (value === undefined) {
      setInternalValue(nextValue);
    }
    onValueChange?.(nextValue);
  }

  function toggleValue(optionValue: string) {
    const exists = selectedValues.includes(optionValue);
    const nextValue = exists
      ? selectedValues.filter((valueItem) => valueItem !== optionValue)
      : [...selectedValues, optionValue];

    updateValue(nextValue);
  }

  function removeValue(optionValue: string, event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    updateValue(selectedValues.filter((valueItem) => valueItem !== optionValue));
  }

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {name &&
        selectedValues.map((selectedValue) => (
          <input
            key={selectedValue}
            type="hidden"
            name={name}
            value={selectedValue}
          />
        ))}
      <button
        type="button"
        className={cn(
          "flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-left text-sm text-fleet-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_16px_rgba(15,23,42,0.04)] outline-none transition hover:border-emerald-200 focus:border-fleet-green focus:bg-white focus:ring-2 focus:ring-emerald-100",
          selectedOptions.length === 0 && "text-zinc-400",
          disabled && "cursor-not-allowed bg-zinc-100 text-zinc-400",
        )}
        disabled={disabled}
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          setQuery("");
        }}
      >
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {selectedOptions.length > 0 ? (
            selectedOptions.map((option) => (
              <span
                key={option.value}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-fleet-green"
              >
                {option.label}
                <button
                  type="button"
                  onClick={(event) => removeValue(option.value, event)}
                  className="inline-flex"
                >
                  <X size={12} />
                </button>
              </span>
            ))
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={cn("shrink-0 text-zinc-400 transition", open && "rotate-180")}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9998] overflow-hidden rounded-lg border border-white/80 bg-white/95 shadow-[0_22px_60px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/80 backdrop-blur-xl"
            style={{
              left: dropdownRect.left,
              top: dropdownRect.top,
              width: dropdownRect.width,
            }}
          >
            {searchable && (
              <div className="border-b border-slate-200 p-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-zinc-400" size={16} />
                  <input
                    autoFocus
                    className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-fleet-green focus:ring-2 focus:ring-emerald-100"
                    placeholder={searchPlaceholder}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
              </div>
            )}
            <div
              className="overflow-y-auto p-1"
              style={{ maxHeight: searchable ? dropdownRect.maxHeight - 54 : dropdownRect.maxHeight }}
            >
              {filteredOptions.length === 0 && (
                <p className="px-3 py-2 text-sm text-zinc-500">{emptyMessage}</p>
              )}
              {filteredOptions.map((option) => {
                const selected = selectedValues.includes(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-fleet-ink transition hover:bg-emerald-50/80",
                      selected && "bg-emerald-50 font-medium text-fleet-green",
                      option.disabled &&
                        "cursor-not-allowed text-zinc-400 hover:bg-transparent",
                    )}
                    onClick={() => toggleValue(option.value)}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                    {selected && <Check size={15} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
