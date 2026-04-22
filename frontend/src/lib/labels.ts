export const statusLabels: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  blocked: 'Bloqueado',
  vacation: 'Ferias',
  available: 'Disponível',
  in_route: 'Em rota',
  stopped: 'Parado',
  maintenance: 'Manutenção',
  open: 'Aberto',
  scheduled: 'Agendado',
  in_progress: 'Em execução',
  closed: 'Fechado',
  cancelled: 'Cancelado',
  valid: 'Válido',
  expiring: 'A vencer',
  expired: 'Vencido',
  pending_review: 'Pendente de revisão',
  passed: 'Aprovado',
  failed: 'Reprovado',
  pending: 'Pendente',
  ok: 'OK',
  reported: 'Informado',
  info: 'Informativo',
  bom: 'Bom',
  médio: 'Medio',
  ruim: 'Ruim',
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Critica',
  warning: 'Alerta',
  ativo: 'Ativo',
  preparado: 'Preparado'
};

export const vehicleStatusLabels: Record<string, string> = {
  available: 'Disponível',
  in_route: 'Em rota',
  stopped: 'Parado',
  maintenance: 'Manutenção',
  inactive: 'Inativo',
  blocked: 'Bloqueado'
};

export const maintenanceStatusLabels: Record<string, string> = {
  open: 'Aberta',
  scheduled: 'Agendada',
  in_progress: 'Em execução',
  closed: 'Finalizada',
  cancelled: 'Cancelada'
};

export const priorityLabels: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Critica'
};

export const maintenanceTypeLabels: Record<string, string> = {
  preventive: 'Preventiva',
  corrective: 'Corretiva',
  predictive: 'Preditiva'
};

export const severityLabels: Record<string, string> = {
  info: 'Informativo',
  warning: 'Alerta',
  critical: 'Critica'
};

export const documentTypeLabels: Record<string, string> = {
  crlv: 'CRLV',
  insurance: 'Seguro',
  licensing: 'Licenciamento',
  inspection: 'Inspeção',
  cnh: 'CNH',
  other: 'Outro'
};

export const entityTypeLabels: Record<string, string> = {
  vehicle: 'Veículo',
  driver: 'Motorista'
};

export function labelFor(value?: string | null, labels: Record<string, string> = statusLabels) {
  if (!value) {
    return '-';
  }
  return labels[value] ?? statusLabels[value] ?? value;
}
