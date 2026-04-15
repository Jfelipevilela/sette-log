import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, KeyRound, PlugZap, ShieldCheck, Upload, UsersRound, Webhook } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { saveSetting, uploadLegacySpreadsheet } from '../../lib/api';

const settings = [
  { icon: UsersRound, title: 'Usuarios e perfis', detail: 'RBAC por papel e permissao granular', status: 'ativo' },
  { icon: PlugZap, title: 'Integracoes', detail: 'ERP, TMS, WMS, mapas e rastreadores', status: 'preparado' },
  { icon: Webhook, title: 'Webhooks', detail: 'Eventos operacionais assinados por segredo', status: 'preparado' },
  { icon: KeyRound, title: 'Tokens de API', detail: 'Credenciais para clientes e servicos externos', status: 'preparado' }
];

const importResources = [
  { value: 'vehicles', label: 'Veiculos' },
  { value: 'drivers', label: 'Motoristas' },
  { value: 'fuel-records', label: 'Abastecimentos' },
  { value: 'maintenance-orders', label: 'Ordens de manutencao' },
  { value: 'documents', label: 'Documentos' }
];

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string>();
  const [importResource, setImportResource] = useState('vehicles');
  const [importFile, setImportFile] = useState<File>();
  const [importResult, setImportResult] = useState<Awaited<ReturnType<typeof uploadLegacySpreadsheet>>>();
  const saveSettingsMutation = useMutation({
    mutationFn: async (payload: { speedLimit: number; expirationDays: number; idleMinutes: number }) => {
      await Promise.all([
        saveSetting('alerts.speed_limit_kph', payload.speedLimit),
        saveSetting('alerts.document_expiration_days', payload.expirationDays),
        saveSetting('fleet.default_idle_minutes', payload.idleMinutes)
      ]);
    },
    onSuccess: async () => {
      setMessage('Parametros salvos com sucesso.');
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => setMessage('Nao foi possivel salvar os parametros.')
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!importFile) {
        throw new Error('Selecione um arquivo CSV ou XLSX.');
      }
      return uploadLegacySpreadsheet(importResource, importFile);
    },
    onSuccess: async (result) => {
      setImportResult(result);
      setMessage(
        `Importacao concluida: ${result.imported} inseridos, ${result.updated} atualizados, ${result.failed} falhas.`
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
        queryClient.invalidateQueries({ queryKey: ['drivers'] }),
        queryClient.invalidateQueries({ queryKey: ['tracking-live'] }),
        queryClient.invalidateQueries({ queryKey: ['maintenance-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['compliance-documents'] })
      ]);
    },
    onError: (error) => {
      setImportResult(undefined);
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel importar a planilha.');
    }
  });

  function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    saveSettingsMutation.mutate({
      speedLimit: Number(form.get('speedLimit') || 90),
      expirationDays: Number(form.get('expirationDays') || 30),
      idleMinutes: Number(form.get('idleMinutes') || 20)
    });
  }

  return (
    <form className="space-y-6" onSubmit={handleSaveSettings}>
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Configuracoes</h2>
          <p className="mt-1 text-sm text-zinc-500">Usuarios, perfis, filiais, alertas, integracoes, webhooks e tokens.</p>
        </div>
        <Button type="submit" disabled={saveSettingsMutation.isPending}>
          <ShieldCheck size={18} />
          {saveSettingsMutation.isPending ? 'Salvando...' : 'Salvar parametros'}
        </Button>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {settings.map((item) => (
          <Card key={item.title} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-100 text-fleet-ink">
                  <item.icon size={20} />
                </span>
                <div>
                  <strong className="block">{item.title}</strong>
                  <p className="mt-1 text-sm text-zinc-500">{item.detail}</p>
                </div>
              </div>
              <Badge tone={item.status === 'ativo' ? 'green' : 'cyan'}>{item.status}</Badge>
            </div>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Importar dados antigos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end">
            <label className="space-y-2 text-sm font-medium">
              Tipo de dado
              <Select value={importResource} onChange={(event) => setImportResource(event.target.value)}>
                {importResources.map((resource) => (
                  <option key={resource.value} value={resource.value}>
                    {resource.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Arquivo CSV ou XLSX
              <Input
                type="file"
                accept=".csv,.xlsx"
                onChange={(event) => {
                  setImportFile(event.target.files?.[0]);
                  setImportResult(undefined);
                }}
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <a
                className="inline-flex h-10 items-center justify-center rounded-md border border-fleet-line bg-white px-4 text-sm font-medium text-fleet-ink transition hover:bg-zinc-50"
                href="/templates/sette-log-importacao-template.xlsx"
                download
              >
                Baixar template
              </a>
              <Button
                type="button"
                className="w-full lg:w-auto"
                disabled={!importFile || importMutation.isPending}
                onClick={() => importMutation.mutate()}
              >
                <Upload size={18} />
                {importMutation.isPending ? 'Importando...' : 'Importar'}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-fleet-line bg-zinc-50 p-4 text-sm text-zinc-600">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="mt-0.5 text-fleet-green" size={18} />
              <div>
                <strong className="block text-zinc-800">Ordem recomendada</strong>
                <p className="mt-1">
                  Importe primeiro veiculos e motoristas. Depois suba abastecimentos, manutencoes e documentos, porque
                  essas planilhas usam placa ou CNH para vincular os historicos.
                </p>
                <p className="mt-2">
                  O template possui uma aba para cada tipo de dado. A primeira linha precisa conter os cabecalhos:
                  placa, modelo, marca, odometro, nome, cnh, validade_cnh, litros, valor_total, vencimento.
                </p>
              </div>
            </div>
          </div>

          {importResult && (
            <div className="rounded-lg border border-fleet-line p-4 text-sm">
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <span className="block text-zinc-500">Linhas</span>
                  <strong>{importResult.totalRows}</strong>
                </div>
                <div>
                  <span className="block text-zinc-500">Inseridos</span>
                  <strong>{importResult.imported}</strong>
                </div>
                <div>
                  <span className="block text-zinc-500">Atualizados</span>
                  <strong>{importResult.updated}</strong>
                </div>
                <div>
                  <span className="block text-zinc-500">Falhas</span>
                  <strong>{importResult.failed}</strong>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-4 space-y-2">
                  <strong className="text-zinc-800">Primeiros erros encontrados</strong>
                  {importResult.errors.slice(0, 5).map((error) => (
                    <p key={`${error.row}-${error.message}`} className="text-zinc-600">
                      Linha {error.row}: {error.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parametros de alerta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2 text-sm font-medium">
              Velocidade maxima
              <Input name="speedLimit" type="number" min="1" defaultValue="90" />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Dias para vencimento
              <Input name="expirationDays" type="number" min="1" defaultValue="30" />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Tempo parado em minutos
              <Input name="idleMinutes" type="number" min="1" defaultValue="20" />
            </label>
          </div>
          {message && <p className="mt-4 text-sm text-zinc-600">{message}</p>}
        </CardContent>
      </Card>
    </form>
  );
}
