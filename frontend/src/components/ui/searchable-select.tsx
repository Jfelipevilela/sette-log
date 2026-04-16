import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = value ?? internalValue;
  const selectedOption = options.find((option) => option.value === selectedValue);

  useEffect(() => {
    if (value === undefined) {
      setInternalValue(defaultValue);
    }
  }, [defaultValue, value]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

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
          'flex h-10 w-full items-center justify-between gap-3 rounded-md border border-fleet-line bg-white/95 px-3 text-left text-sm text-fleet-ink shadow-sm outline-none transition hover:border-zinc-300 focus:border-fleet-green focus:bg-white focus:ring-2 focus:ring-emerald-100',
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

      {open && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-md border border-fleet-line bg-white shadow-xl">
          {searchable && (
            <div className="border-b border-fleet-line p-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-zinc-400" size={16} />
                <input
                  autoFocus
                  className="h-9 w-full rounded-md border border-fleet-line bg-white pl-9 pr-3 text-sm outline-none focus:border-fleet-green focus:ring-2 focus:ring-emerald-100"
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
          )}
          <div className="max-h-64 overflow-y-auto p-1">
            {filteredOptions.length === 0 && <p className="px-3 py-2 text-sm text-zinc-500">{emptyMessage}</p>}
            {filteredOptions.map((option) => (
              <button
                key={option.value || '__empty'}
                type="button"
                disabled={option.disabled}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm text-fleet-ink transition hover:bg-emerald-50',
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
      )}
    </div>
  );
}
