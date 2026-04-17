import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getAuditTrail } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';
import { Badge } from './badge';
import { Modal } from './modal';

type DetailField = {
  label: string;
  value?: string | number | null;
};

type DetailModalProps = {
  open: boolean;
  title: string;
  description?: string;
  entityId?: string;
  fields: DetailField[];
  children?: ReactNode;
  onClose: () => void;
};

const actionLabels: Record<string, string> = {
  POST: 'Criado',
  PATCH: 'Editado',
  PUT: 'Editado',
  DELETE: 'Excluido'
};

export function DetailModal({ open, title, description, entityId, fields, children, onClose }: DetailModalProps) {
  const { data: auditTrail = [] } = useQuery({
    queryKey: ['audit-trail', entityId],
    queryFn: () => getAuditTrail(entityId ?? ''),
    enabled: open && Boolean(entityId)
  });

  const createdBy = auditTrail
    .slice()
    .reverse()
    .find((item) => item.action === 'POST');

  return (
    <Modal open={open} title={title} description={description} onClose={onClose}>
      <div className="space-y-5">
        {createdBy && (
          <div className="rounded-lg border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <span className="block text-sm text-zinc-500">Inserido por</span>
            <strong className="mt-1 block">{createdBy.actorName ?? 'Sistema'}</strong>
            <span className="text-sm text-zinc-500">
              {createdBy.actorEmail ? `${createdBy.actorEmail} - ` : ''}
              {formatDateTime(createdBy.createdAt)}
            </span>
          </div>
        )}

        <dl className="grid gap-3 md:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className="rounded-lg border border-slate-200 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
              <dt className="text-xs uppercase text-zinc-500">{field.label}</dt>
              <dd className="mt-1 font-medium text-fleet-ink">{field.value === undefined || field.value === null || field.value === '' ? '-' : field.value}</dd>
            </div>
          ))}
        </dl>

        {children}

        <div>
          <strong className="block text-sm text-fleet-ink">Histórico de auditoria</strong>
          <div className="mt-3 space-y-2">
            {auditTrail.length === 0 && <p className="text-sm text-zinc-500">Nenhum evento de auditoria encontrado para este registro.</p>}
            {auditTrail.map((item) => (
              <div key={item._id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone={item.action === 'DELETE' ? 'red' : item.action === 'POST' ? 'green' : 'cyan'}>
                      {actionLabels[item.action] ?? item.action}
                    </Badge>
                    <strong className="text-sm">{item.actorName ?? 'Sistema'}</strong>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{item.actorEmail ?? item.path}</p>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">{formatDateTime(item.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
