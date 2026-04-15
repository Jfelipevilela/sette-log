import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Edit2, Eye, FilePlus2, FileWarning, ShieldAlert, Trash2 } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { DetailModal } from '../../components/ui/detail-modal';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { Table, Td, Th } from '../../components/ui/table';
import {
  apiErrorMessage,
  createComplianceCheck,
  createDocument,
  deleteDocument,
  getDrivers,
  getVehicles,
  listResource,
  updateDocument
} from '../../lib/api';
import type { DocumentRecord } from '../../lib/types';
import { formatDate } from '../../lib/utils';

export function CompliancePage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<DocumentRecord>();
  const [detailDocument, setDetailDocument] = useState<DocumentRecord>();
  const [documentEntityType, setDocumentEntityType] = useState('vehicle');
  const [formError, setFormError] = useState<string>();
  const [documentError, setDocumentError] = useState<string>();
  const { data: documents = [] } = useQuery({
    queryKey: ['compliance-documents'],
    queryFn: () => listResource<DocumentRecord>('/compliance/documents')
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => getVehicles()
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => getDrivers()
  });
  const createCheckMutation = useMutation({
    mutationFn: createComplianceCheck,
    onSuccess: async () => {
      setIsModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['compliance-documents'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => setFormError('Nao foi possivel salvar o checklist.')
  });
  const createDocumentMutation = useMutation({
    mutationFn: createDocument,
    onSuccess: async () => {
      closeDocumentModal();
      await invalidateComplianceData();
    },
    onError: (error) => setDocumentError(apiErrorMessage(error, 'Nao foi possivel criar o documento.'))
  });
  const updateDocumentMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => updateDocument(id, payload),
    onSuccess: async () => {
      closeDocumentModal();
      await invalidateComplianceData();
    },
    onError: (error) => setDocumentError(apiErrorMessage(error, 'Nao foi possivel editar o documento.'))
  });
  const deleteDocumentMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: invalidateComplianceData,
    onError: (error) => setDocumentError(apiErrorMessage(error, 'Nao foi possivel excluir o documento.'))
  });

  async function invalidateComplianceData() {
    await queryClient.invalidateQueries({ queryKey: ['compliance-documents'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }

  function openDocumentCreateModal() {
    setEditingDocument(undefined);
    setDocumentEntityType('vehicle');
    setDocumentError(undefined);
    setIsDocumentModalOpen(true);
  }

  function openDocumentEditModal(document: DocumentRecord) {
    setEditingDocument(document);
    setDocumentEntityType(document.entityType);
    setDocumentError(undefined);
    setIsDocumentModalOpen(true);
  }

  function closeDocumentModal() {
    setEditingDocument(undefined);
    setDocumentError(undefined);
    setIsDocumentModalOpen(false);
  }

  const checks = [
    { label: 'CRLV', status: 'valid', coverage: '96%' },
    { label: 'Seguro', status: 'expiring', coverage: '88%' },
    { label: 'Checklist digital', status: 'pending', coverage: '74%' }
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Compliance</h2>
          <p className="mt-1 text-sm text-zinc-500">Documentos, checklists, pendencias e trilha de auditoria.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={openDocumentCreateModal}>
            <FilePlus2 size={18} />
            Novo documento
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>
            <CheckCircle2 size={18} />
            Novo checklist
          </Button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {checks.map((item) => (
          <Card key={item.label} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-sm text-zinc-500">{item.label}</span>
                <strong className="mt-2 block text-3xl">{item.coverage}</strong>
              </div>
              <Badge tone={item.status === 'valid' ? 'green' : item.status === 'expiring' ? 'amber' : 'red'}>{item.status}</Badge>
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Documentos vencendo</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Tipo</Th>
                  <Th>Entidade</Th>
                  <Th>Numero</Th>
                  <Th>Vencimento</Th>
                  <Th>Status</Th>
                  <Th>Acoes</Th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document._id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <FileWarning size={16} className="text-fleet-amber" />
                        <strong>{document.type}</strong>
                      </div>
                    </Td>
                    <Td>{document.entityType}</Td>
                    <Td>{document.number ?? '-'}</Td>
                    <Td>{formatDate(document.expiresAt)}</Td>
                    <Td>
                      <Badge tone={document.status === 'expired' ? 'red' : document.status === 'expiring' ? 'amber' : 'green'}>
                        {document.status}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => openDocumentEditModal(document)}>
                          <Edit2 size={15} />
                          Editar
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setDetailDocument(document)}>
                          <Eye size={15} />
                          Detalhes
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          disabled={deleteDocumentMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Excluir o documento ${document.type}?`)) {
                              deleteDocumentMutation.mutate(document._id);
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auditoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-fleet-line p-4">
              <ShieldAlert size={18} className="text-fleet-red" />
              <strong className="mt-3 block">Acoes criticas auditadas</strong>
              <p className="mt-1 text-sm text-zinc-500">Criacao, alteracao e exclusao passam pelo interceptor global da API.</p>
            </div>
            <div className="rounded-lg border border-fleet-line p-4">
              <strong className="block">Checklist versionado</strong>
              <p className="mt-1 text-sm text-zinc-500">Cada execucao registra versao, itens avaliados e resultado.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Modal
        open={isDocumentModalOpen}
        title={editingDocument ? 'Editar documento' : 'Novo documento'}
        description="Cadastre vencimentos, numeros e anexos logicos de documentos da frota."
        onClose={closeDocumentModal}
      >
        <form
          className="space-y-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            setDocumentError(undefined);
            const form = new FormData(event.currentTarget);
            const payload = {
              entityType: documentEntityType,
              entityId: String(form.get('entityId') ?? ''),
              type: String(form.get('type') ?? ''),
              number: String(form.get('number') ?? ''),
              issuedAt: String(form.get('issuedAt') ?? '') || undefined,
              expiresAt: String(form.get('expiresAt') ?? '') || undefined,
              fileUrl: String(form.get('fileUrl') ?? '')
            };
            if (editingDocument) {
              updateDocumentMutation.mutate({ id: editingDocument._id, payload });
              return;
            }
            createDocumentMutation.mutate(payload);
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Entidade
              <Select value={documentEntityType} onChange={(event) => setDocumentEntityType(event.target.value)}>
                <option value="vehicle">Veiculo</option>
                <option value="driver">Motorista</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Referencia
              <Select name="entityId" defaultValue={editingDocument?.entityId ?? ''} required>
                <option value="" disabled>
                  Selecione
                </option>
                {documentEntityType === 'vehicle'
                  ? vehicles.map((vehicle) => (
                      <option key={vehicle._id} value={vehicle._id}>
                        {vehicle.plate} - {vehicle.model}
                      </option>
                    ))
                  : drivers.map((driver) => (
                      <option key={driver._id} value={driver._id}>
                        {driver.name} - CNH {driver.licenseNumber}
                      </option>
                    ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Tipo
              <Input name="type" placeholder="CRLV, seguro, licenciamento" defaultValue={editingDocument?.type} required />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Numero
              <Input name="number" placeholder="Numero do documento" defaultValue={editingDocument?.number} />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Emissao
              <Input name="issuedAt" type="date" defaultValue={editingDocument?.issuedAt?.slice(0, 10)} />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Vencimento
              <Input name="expiresAt" type="date" defaultValue={editingDocument?.expiresAt?.slice(0, 10)} />
            </label>
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              URL do arquivo
              <Input name="fileUrl" placeholder="https://..." defaultValue={editingDocument?.fileUrl} />
            </label>
          </div>
          {documentError && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{documentError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeDocumentModal}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createDocumentMutation.isPending || updateDocumentMutation.isPending}>
              {createDocumentMutation.isPending || updateDocumentMutation.isPending ? 'Salvando...' : 'Salvar documento'}
            </Button>
          </div>
        </form>
      </Modal>

      <DetailModal
        open={Boolean(detailDocument)}
        entityId={detailDocument?._id}
        title="Detalhes do documento"
        description="Informacoes documentais, vencimento e trilha de auditoria."
        onClose={() => setDetailDocument(undefined)}
        fields={[
          { label: 'Tipo', value: detailDocument?.type },
          { label: 'Entidade', value: detailDocument?.entityType },
          {
            label: 'Referencia',
            value: detailDocument
              ? detailDocument.entityType === 'driver'
                ? drivers.find((driver) => driver._id === detailDocument.entityId)?.name ?? detailDocument.entityId
                : vehicles.find((vehicle) => vehicle._id === detailDocument.entityId)?.plate ?? detailDocument.entityId
              : undefined
          },
          { label: 'Numero', value: detailDocument?.number },
          { label: 'Emissao', value: formatDate(detailDocument?.issuedAt) },
          { label: 'Vencimento', value: formatDate(detailDocument?.expiresAt) },
          { label: 'Status', value: detailDocument?.status },
          { label: 'Arquivo', value: detailDocument?.fileUrl }
        ]}
      />

      <Modal
        open={isModalOpen}
        title="Novo checklist"
        description="Registre um checklist versionado para veiculo e motorista."
        onClose={() => setIsModalOpen(false)}
      >
        <form
          className="space-y-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            setFormError(undefined);
            const form = new FormData(event.currentTarget);
            const vehicleId = String(form.get('vehicleId') ?? '');
            const driverId = String(form.get('driverId') ?? '');
            createCheckMutation.mutate({
              vehicleId: vehicleId || undefined,
              driverId: driverId || undefined,
              checklistVersion: String(form.get('checklistVersion') ?? 'v1'),
              status: String(form.get('status') ?? 'passed'),
              performedAt: new Date().toISOString(),
              items: [
                { key: 'documents', label: 'Documentos obrigatorios', result: form.get('documents') },
                { key: 'tires', label: 'Pneus e rodas', result: form.get('tires') },
                { key: 'lights', label: 'Luzes e sinalizacao', result: form.get('lights') },
                { key: 'notes', label: 'Observacoes', result: 'info', notes: form.get('notes') }
              ]
            });
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Veiculo
              <Select name="vehicleId" defaultValue="">
                <option value="">Nao informado</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle._id} value={vehicle._id}>
                    {vehicle.plate} - {vehicle.model}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Motorista
              <Select name="driverId" defaultValue="">
                <option value="">Nao informado</option>
                {drivers.map((driver) => (
                  <option key={driver._id} value={driver._id}>
                    {driver.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Versao
              <Input name="checklistVersion" defaultValue="v1" />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Resultado final
              <Select name="status" defaultValue="passed">
                <option value="passed">Aprovado</option>
                <option value="failed">Reprovado</option>
                <option value="pending">Pendente</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Documentos
              <Select name="documents" defaultValue="ok">
                <option value="ok">OK</option>
                <option value="failed">Falha</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Pneus e rodas
              <Select name="tires" defaultValue="ok">
                <option value="ok">OK</option>
                <option value="failed">Falha</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Luzes
              <Select name="lights" defaultValue="ok">
                <option value="ok">OK</option>
                <option value="failed">Falha</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Observacoes
              <Input name="notes" placeholder="Sem observacoes" />
            </label>
          </div>
          {formError && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createCheckMutation.isPending}>
              {createCheckMutation.isPending ? 'Salvando...' : 'Salvar checklist'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
