import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Eye, Fuel, Plus, Trash2 } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { DetailModal } from '../../components/ui/detail-modal';
import { Input } from '../../components/ui/input';
import { LoadingState } from '../../components/ui/loading-state';
import { Modal } from '../../components/ui/modal';
import { Pagination } from '../../components/ui/pagination';
import { Select } from '../../components/ui/select';
import { Table, Td, Th } from '../../components/ui/table';
import {
  apiErrorMessage,
  createFuelRecord,
  deleteFuelRecord,
  downloadFuelRecordAttachment,
  getDrivers,
  getVehicles,
  listResourcePage,
  updateFuelRecord,
  uploadFuelRecordAttachment
} from '../../lib/api';
import type { FuelRecord } from '../../lib/types';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';

const fuelLabels: Record<string, string> = {
  gasoline: 'Gasolina',
  ethanol: 'Etanol',
  diesel: 'Diesel',
  gnv: 'GNV',
  electric: 'Eletrico'
};

export function FuelRecordsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FuelRecord>();
  const [detailRecord, setDetailRecord] = useState<FuelRecord>();
  const [formError, setFormError] = useState<string>();
  const [page, setPage] = useState(1);
  const [attachmentFile, setAttachmentFile] = useState<File>();

  const { data: recordsPage, isLoading: recordsLoading } = useQuery({
    queryKey: ['fuel-records', page],
    queryFn: () => listResourcePage<FuelRecord>('/finance/fuel-records', { page, limit: 10, sortBy: 'filledAt', sortDir: 'desc' })
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => getVehicles()
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => getDrivers()
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const created = await createFuelRecord(payload);
      if (attachmentFile) {
        await uploadFuelRecordAttachment(created._id, attachmentFile);
      }
      return created;
    },
    onSuccess: async () => {
      closeModal();
      await invalidateFuelData();
    },
    onError: (error) => setFormError(apiErrorMessage(error, 'Nao foi possivel registrar o abastecimento.'))
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const updated = await updateFuelRecord(id, payload);
      if (attachmentFile) {
        await uploadFuelRecordAttachment(id, attachmentFile);
      }
      return updated;
    },
    onSuccess: async () => {
      closeModal();
      await invalidateFuelData();
    },
    onError: (error) => setFormError(apiErrorMessage(error, 'Nao foi possivel editar o abastecimento.'))
  });
  const deleteMutation = useMutation({
    mutationFn: deleteFuelRecord,
    onSuccess: invalidateFuelData,
    onError: (error) => setFormError(apiErrorMessage(error, 'Nao foi possivel excluir o abastecimento.'))
  });

  const records = recordsPage?.data ?? [];
  const summary = useMemo(() => {
    const liters = records.reduce((total, record) => total + Number(record.liters ?? 0), 0);
    const totalCost = records.reduce((total, record) => total + Number(record.totalCost ?? 0), 0);
    return {
      count: records.length,
      liters,
      totalCost,
      averagePrice: liters > 0 ? totalCost / liters : 0
    };
  }, [records]);

  async function invalidateFuelData() {
    await queryClient.invalidateQueries({ queryKey: ['fuel-records'] });
    await queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    await queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
  }

  function vehicleLabel(vehicleId: string) {
    const vehicle = vehicles.find((item) => item._id === vehicleId);
    return vehicle ? `${vehicle.plate} - ${vehicle.nickname ?? vehicle.model}` : vehicleId;
  }

  function driverLabel(driverId?: string) {
    if (!driverId) {
      return '-';
    }
    return drivers.find((item) => item._id === driverId)?.name ?? driverId;
  }

  function openCreateModal() {
    setEditingRecord(undefined);
    setFormError(undefined);
    setIsModalOpen(true);
  }

  function openEditModal(record: FuelRecord) {
    setEditingRecord(record);
    setFormError(undefined);
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingRecord(undefined);
    setFormError(undefined);
    setAttachmentFile(undefined);
    setIsModalOpen(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    const form = new FormData(event.currentTarget);
    const liters = Number(form.get('liters') || 0);
    const totalCost = Number(form.get('totalCost') || 0);
    const pricePerLiter = Number(form.get('pricePerLiter') || 0);
    const driverId = String(form.get('driverId') ?? '');
    const vehicleId = String(form.get('vehicleId') ?? '');
    const vehicle = vehicles.find((item) => item._id === vehicleId);
    if (vehicle?.tankCapacityLiters && liters > vehicle.tankCapacityLiters) {
      setFormError(`Litros informados excedem a capacidade do tanque (${vehicle.tankCapacityLiters} L).`);
      return;
    }
    if (pricePerLiter <= 0) {
      setFormError('Informe o valor pago por litro.');
      return;
    }
    if (Math.abs(liters * pricePerLiter - totalCost) > 0.05) {
      setFormError('Litros x valor por litro nao conferem com o valor total.');
      return;
    }
    const payload = {
      vehicleId,
      driverId: driverId || undefined,
      liters,
      totalCost,
      pricePerLiter,
      odometerKm: Number(form.get('odometerKm') || 0),
      filledAt: String(form.get('filledAt') ?? '') || new Date().toISOString(),
      station: String(form.get('station') ?? ''),
      fuelType: String(form.get('fuelType') ?? 'gasoline')
    };

    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord._id, payload });
      return;
    }
    createMutation.mutate(payload);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Abastecimentos</h2>
          <p className="mt-1 text-sm text-zinc-500">Lançamentos por veículo, litros, custo e odometro para alimentar os indicadores.</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus size={18} />
          Novo abastecimento
        </Button>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <Fuel className="text-fleet-green" />
          <span className="mt-4 block text-sm text-zinc-500">Lançamentos</span>
          <strong className="mt-2 block text-3xl">{summary.count}</strong>
        </Card>
        <Card className="p-5">
          <span className="text-sm text-zinc-500">Litros registrados</span>
          <strong className="mt-2 block text-3xl">{summary.liters.toLocaleString('pt-BR')} L</strong>
        </Card>
        <Card className="p-5">
          <span className="text-sm text-zinc-500">Custo total</span>
          <strong className="mt-2 block text-3xl">{formatCurrency(summary.totalCost)}</strong>
        </Card>
        <Card className="p-5">
          <span className="text-sm text-zinc-500">Preço médio por litro</span>
          <strong className="mt-2 block text-3xl">{formatCurrency(summary.averagePrice)}</strong>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Historico de abastecimentos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {recordsLoading ? (
            <LoadingState label="Carregando abastecimentos..." />
          ) : (
            <div className="space-y-4">
              <Table>
                <thead>
                  <tr>
                    <Th>Data</Th>
                    <Th>Veiculo</Th>
                    <Th>Motorista</Th>
                    <Th>Combustivel</Th>
                    <Th>Litros</Th>
                    <Th>R$/L</Th>
                    <Th>Total</Th>
                    <Th>Anexos</Th>
                    <Th>Acoes</Th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record._id}>
                      <Td>{formatDate(record.filledAt)}</Td>
                      <Td>
                        <strong>{vehicleLabel(record.vehicleId)}</strong>
                        <span className="block text-xs text-zinc-500">{record.station ?? '-'}</span>
                      </Td>
                      <Td>{driverLabel(record.driverId)}</Td>
                      <Td>
                        <Badge tone="cyan">{fuelLabels[record.fuelType] ?? record.fuelType}</Badge>
                      </Td>
                      <Td>{Number(record.liters ?? 0).toLocaleString('pt-BR')} L</Td>
                      <Td>{formatCurrency(Number(record.pricePerLiter ?? 0))}</Td>
                      <Td>{formatCurrency(Number(record.totalCost ?? 0))}</Td>
                      <Td>{record.attachments?.length ?? 0}</Td>
                      <Td>
                        <div className="flex gap-2">
                          <Button type="button" variant="secondary" size="sm" onClick={() => openEditModal(record)}>
                            <Edit2 size={15} />
                            Editar
                          </Button>
                          <Button type="button" variant="secondary" size="sm" onClick={() => setDetailRecord(record)}>
                            <Eye size={15} />
                            Detalhes
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (window.confirm('Excluir este abastecimento?')) {
                                deleteMutation.mutate(record._id);
                              }
                            }}
                          >
                            <Trash2 size={15} />
                            Excluir
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination
                page={recordsPage?.meta.page ?? page}
                totalPages={recordsPage?.meta.totalPages ?? 1}
                total={recordsPage?.meta.total ?? 0}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={isModalOpen}
        title={editingRecord ? 'Editar abastecimento' : 'Novo abastecimento'}
        description="Informe veiculo, combustivel, litros, valor e odometro no momento do abastecimento."
        onClose={closeModal}
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Veiculo
              <Select name="vehicleId" required defaultValue={editingRecord?.vehicleId ?? ''}>
                <option value="" disabled>
                  Selecione
                </option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle._id} value={vehicle._id}>
                    {vehicle.plate} - {vehicle.nickname ?? vehicle.model}
                    {vehicle.tankCapacityLiters ? ` (${vehicle.tankCapacityLiters} L)` : ''}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Motorista
              <Select name="driverId" defaultValue={editingRecord?.driverId ?? ''}>
                <option value="">Nao informado</option>
                {drivers.map((driver) => (
                  <option key={driver._id} value={driver._id}>
                    {driver.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Combustivel
              <Select name="fuelType" defaultValue={editingRecord?.fuelType ?? 'gasoline'}>
                <option value="gasoline">Gasolina</option>
                <option value="ethanol">Etanol</option>
                <option value="diesel">Diesel</option>
                <option value="gnv">GNV</option>
                <option value="electric">Eletrico</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Litros
              <Input name="liters" type="number" min="0.01" step="0.01" defaultValue={editingRecord?.liters} required />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Valor por litro
              <Input
                name="pricePerLiter"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={editingRecord?.pricePerLiter ?? (editingRecord?.liters ? Number(editingRecord.totalCost ?? 0) / editingRecord.liters : undefined)}
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Valor total
              <Input name="totalCost" type="number" min="0" step="0.01" defaultValue={editingRecord?.totalCost} required />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Odometro
              <Input name="odometerKm" type="number" min="0" defaultValue={editingRecord?.odometerKm ?? 0} />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Data
              <Input name="filledAt" type="datetime-local" defaultValue={editingRecord?.filledAt?.slice(0, 16)} />
            </label>
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Posto / fornecedor
              <Input name="station" placeholder="Posto ou fornecedor" defaultValue={editingRecord?.station} />
            </label>
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Nota fiscal / comprovante
              <Input
                name="attachment"
                type="file"
                accept="image/*,.pdf,.xml,.txt,.csv,.xlsx"
                onChange={(event) => setAttachmentFile(event.target.files?.[0])}
              />
              <span className="block text-xs font-normal text-zinc-500">Aceita imagem, PDF, XML, TXT, CSV ou XLSX ate 10 MB.</span>
            </label>
          </div>
          {formError && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar abastecimento'}
            </Button>
          </div>
        </form>
      </Modal>

      <DetailModal
        open={Boolean(detailRecord)}
        entityId={detailRecord?._id}
        title="Detalhes do abastecimento"
        description="Informacoes completas do lancamento e trilha de auditoria."
        onClose={() => setDetailRecord(undefined)}
        fields={[
          { label: 'Veiculo', value: detailRecord ? vehicleLabel(detailRecord.vehicleId) : undefined },
          { label: 'Motorista', value: detailRecord ? driverLabel(detailRecord.driverId) : undefined },
          { label: 'Posto / fornecedor', value: detailRecord?.station },
          { label: 'Data e hora', value: formatDateTime(detailRecord?.filledAt) },
          { label: 'Combustivel', value: detailRecord ? fuelLabels[detailRecord.fuelType] ?? detailRecord.fuelType : undefined },
          { label: 'Litros', value: detailRecord ? `${Number(detailRecord.liters ?? 0).toLocaleString('pt-BR')} L` : undefined },
          { label: 'Valor total', value: detailRecord ? formatCurrency(Number(detailRecord.totalCost ?? 0)) : undefined },
          { label: 'Preco por litro', value: detailRecord ? formatCurrency(Number(detailRecord.pricePerLiter ?? 0)) : undefined },
          { label: 'Odometro', value: detailRecord ? `${Number(detailRecord.odometerKm ?? 0).toLocaleString('pt-BR')} km` : undefined }
        ]}
      >
        <div className="rounded-lg border border-fleet-line p-4">
          <strong className="block text-sm text-fleet-ink">Anexos</strong>
          <div className="mt-3 space-y-2">
            {(detailRecord?.attachments?.length ?? 0) === 0 && <p className="text-sm text-zinc-500">Nenhum anexo enviado para este abastecimento.</p>}
            {detailRecord?.attachments?.map((attachment) => (
              <button
                key={attachment.fileName}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-md border border-fleet-line px-3 py-2 text-left text-sm transition hover:bg-zinc-50"
                onClick={() => downloadFuelRecordAttachment(detailRecord._id, attachment)}
              >
                <span className="font-medium text-fleet-ink">{attachment.originalName}</span>
                <span className="shrink-0 text-xs text-zinc-500">{formatDateTime(attachment.uploadedAt)}</span>
              </button>
            ))}
          </div>
        </div>
      </DetailModal>
    </div>
  );
}
