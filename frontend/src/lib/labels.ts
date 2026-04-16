export const statusLabels: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  blocked: 'Bloqueado',
  vacation: 'Ferias',
  available: 'Disponivel',
  in_route: 'Em rota',
  stopped: 'Parado',
  maintenance: 'Manutencao',
  open: 'Aberto',
  scheduled: 'Agendado',
  in_progress: 'Em execucao',
  closed: 'Fechado',
  cancelled: 'Cancelado',
  valid: 'Valido',
  expiring: 'A vencer',
  expired: 'Vencido',
  pending_review: 'Pendente de revisao',
  passed: 'Aprovado',
  failed: 'Reprovado',
  pending: 'Pendente',
  ok: 'OK',
  reported: 'Informado',
  info: 'Informativo',
  bom: 'Bom',
  medio: 'Medio',
  ruim: 'Ruim',
  low: 'Baixa',
  medium: 'Media',
  high: 'Alta',
  critical: 'Critica',
  warning: 'Alerta',
  ativo: 'Ativo',
  preparado: 'Preparado'
};

export const vehicleStatusLabels: Record<string, string> = {
  available: 'Disponivel',
  in_route: 'Em rota',
  stopped: 'Parado',
  maintenance: 'Manutencao',
  inactive: 'Inativo',
  blocked: 'Bloqueado'
};

export const maintenanceStatusLabels: Record<string, string> = {
  open: 'Aberta',
  scheduled: 'Agendada',
  in_progress: 'Em execucao',
  closed: 'Fechada',
  cancelled: 'Cancelada'
};

export const priorityLabels: Record<string, string> = {
  low: 'Baixa',
  medium: 'Media',
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
  inspection: 'Inspecao',
  cnh: 'CNH',
  other: 'Outro'
};

export const entityTypeLabels: Record<string, string> = {
  vehicle: 'Veiculo',
  driver: 'Motorista'
};

export function labelFor(value?: string | null, labels: Record<string, string> = statusLabels) {
  if (!value) {
    return '-';
  }
  return labels[value] ?? statusLabels[value] ?? value;
}
