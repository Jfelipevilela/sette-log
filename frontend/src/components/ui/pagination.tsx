import { Button } from './button';

type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  const safeTotalPages = Math.max(totalPages, 1);

  return (
    <div className="flex flex-col justify-between gap-3 border-t border-fleet-line pt-4 text-sm text-zinc-600 sm:flex-row sm:items-center">
      <span>
        Pagina {page} de {safeTotalPages} - {total} registros
      </span>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Anterior
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={page >= safeTotalPages} onClick={() => onPageChange(page + 1)}>
          Proxima
        </Button>
      </div>
    </div>
  );
}
