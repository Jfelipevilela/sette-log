import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export type SearchableSelectOption = {
  value: string;
  label: string;
  searchText?: string;
  disabled?: boolean;
};

type SearchableSelectProps = {
  name?: string;
  value?: string;
  defaultValue?: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  required?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  className?: string;
  onValueChange?: (value: string) => void;
};

export function SearchableSelect({
  name,
  value,
  defaultValue = '',
  options,
  placeholder = 'Selecione',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nenhum resultado encontrado.',
  required,
  disabled,
  searchable = true,
  className,
  onValueChange
}: SearchableSelectProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [dropdownRect, setDropdownRect] = useState({
    left: 0,
    top: 0,
    width: 0,
    maxHeight: 256,
  });
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const selectedValue = value ?? internalValue;
  const selectedOption = options.find((option) => option.value === selectedValue);

  useEffect(() => {
    if (value === undefined) {
      setInternalValue(defaultValue);
    }
  }, [defaultValue, value]);

  useEffect(() => {
    function updateViewportMode() {
      setIsMobileViewport(window.innerWidth < 640);
    }

    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);
    return () => window.removeEventListener("resize", updateViewportMode);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!wrapperRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
        setQuery('');
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    if (isMobileViewport) {
      document.body.style.overflow = "hidden";
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
      const openAbove = availableBelow < 180 && availableAbove > availableBelow;
      const maxHeight = Math.max(160, Math.min(preferredHeight, openAbove ? availableAbove - margin : availableBelow - margin));

      setDropdownRect({
        left: Math.max(viewportGap, Math.min(trigger.left, window.innerWidth - trigger.width - viewportGap)),
        top: openAbove ? trigger.top - maxHeight - margin : trigger.bottom + margin,
        width: trigger.width,
        maxHeight,
      });
    }

    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [open, isMobileViewport]);

  const filteredOptions = useMemo(() => {
    if (!searchable) {
      return options;
    }
    const term = query.trim().toLowerCase();
    if (!term) {
      return options;
    }
    return options.filter((option) =>
      [option.label, option.searchText, option.value].filter(Boolean).some((item) => String(item).toLowerCase().includes(term))
    );
  }, [options, query]);

  function selectValue(nextValue: string) {
    if (value === undefined) {
      setInternalValue(nextValue);
    }
    onValueChange?.(nextValue);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      {name && <input type="hidden" name={name} value={selectedValue} required={required} />}
      <button
        type="button"
        className={cn(
          'flex h-10 w-full items-center justify-between gap-3 rounded-md border border-slate-200 bg-white/95 px-3 text-left text-sm text-fleet-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_16px_rgba(15,23,42,0.04)] outline-none transition hover:border-emerald-200 focus:border-fleet-green focus:bg-white focus:ring-2 focus:ring-emerald-100',
          !selectedOption && 'text-zinc-400',
          disabled && 'cursor-not-allowed bg-zinc-100 text-zinc-400'
        )}
        disabled={disabled}
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          setQuery('');
        }}
      >
        <span className="min-w-0 truncate">{selectedOption?.label ?? placeholder}</span>
        <ChevronDown size={16} className={cn('shrink-0 text-zinc-400 transition', open && 'rotate-180')} />
      </button>

      {open &&
        createPortal(
          isMobileViewport ? (
            <div
              className="fixed inset-0 z-[9998] flex items-end bg-slate-950/45 p-2 backdrop-blur-sm"
              onMouseDown={() => {
                setOpen(false);
                setQuery("");
              }}
            >
              <div
                ref={dropdownRef}
                className="flex h-[min(78dvh,640px)] w-full flex-col overflow-hidden rounded-t-xl border border-white/80 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/80"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm text-fleet-ink">{placeholder}</strong>
                    <button
                      type="button"
                      className="text-sm font-medium text-zinc-500"
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      Fechar
                    </button>
                  </div>
                  {searchable && (
                    <div className="relative mt-3">
                      <Search className="absolute left-3 top-2.5 text-zinc-400" size={16} />
                      <input
                        autoFocus
                      className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-base outline-none focus:border-fleet-green focus:ring-2 focus:ring-emerald-100 sm:text-sm"
                        placeholder={searchPlaceholder}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
                  {filteredOptions.length === 0 && <p className="px-3 py-2 text-sm text-zinc-500">{emptyMessage}</p>}
                  {filteredOptions.map((option) => (
                    <button
                      key={option.value || '__empty'}
                      type="button"
                      disabled={option.disabled}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left text-sm text-fleet-ink transition hover:bg-emerald-50/80',
                        selectedValue === option.value && 'bg-emerald-50 font-medium text-fleet-green',
                        option.disabled && 'cursor-not-allowed text-zinc-400 hover:bg-transparent'
                      )}
                      onClick={() => selectValue(option.value)}
                    >
                      <span className="min-w-0">{option.label}</span>
                      {selectedValue === option.value && <Check size={15} className="shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
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
                      className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-base outline-none focus:border-fleet-green focus:ring-2 focus:ring-emerald-100 sm:text-sm"
                      placeholder={searchPlaceholder}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </div>
                </div>
              )}
              <div className="overflow-y-auto p-1" style={{ maxHeight: searchable ? dropdownRect.maxHeight - 54 : dropdownRect.maxHeight }}>
                {filteredOptions.length === 0 && <p className="px-3 py-2 text-sm text-zinc-500">{emptyMessage}</p>}
                {filteredOptions.map((option) => (
                  <button
                    key={option.value || '__empty'}
                    type="button"
                    disabled={option.disabled}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-fleet-ink transition hover:bg-emerald-50/80',
                      selectedValue === option.value && 'bg-emerald-50 font-medium text-fleet-green',
                      option.disabled && 'cursor-not-allowed text-zinc-400 hover:bg-transparent'
                    )}
                    onClick={() => selectValue(option.value)}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                    {selectedValue === option.value && <Check size={15} className="shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          ),
          document.body
        )}
    </div>
  );
}
