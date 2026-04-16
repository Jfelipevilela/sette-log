import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ClipboardList,
  Edit2,
  Eye,
  Paperclip,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "../../components/ui/badge";
import { ActionMenu } from "../../components/ui/action-menu";
import { AttachmentPreviewModal } from "../../components/ui/attachment-preview-modal";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { DetailModal } from "../../components/ui/detail-modal";
import { Input } from "../../components/ui/input";
import { Modal } from "../../components/ui/modal";
import { SearchableSelect } from "../../components/ui/searchable-select";
import { Table, Td, Th } from "../../components/ui/table";
import {
  apiErrorMessage,
  createMaintenanceOrder,
  deleteMaintenanceOrder,
  downloadExternalFile,
  getVehicles,
  listResource,
  updateMaintenanceOrder,
} from "../../lib/api";
import {
  labelFor,
  maintenanceStatusLabels,
  maintenanceTypeLabels,
  priorityLabels,
} from "../../lib/labels";
import type { MaintenanceOrder } from "../../lib/types";
import { formatCurrency, formatDate } from "../../lib/utils";

const maintenanceTypeOptions = [
  { value: "preventive", label: "Preventiva" },
  { value: "corrective", label: "Corretiva" },
  { value: "predictive", label: "Preditiva" },
];

const priorityOptions = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Critica" },
];

const maintenanceStatusOptions = [
  { value: "open", label: "Aberta" },
  { value: "scheduled", label: "Agendada" },
  { value: "in_progress", label: "Em execucao" },
  { value: "closed", label: "Fechada" },
  { value: "cancelled", label: "Cancelada" },
];

export function MaintenancePage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<MaintenanceOrder>();
  const [detailOrder, setDetailOrder] = useState<MaintenanceOrder>();
  const [formError, setFormError] = useState<string>();
  const [previewAttachment, setPreviewAttachment] = useState<{
    fileName: string;
    url: string;
  }>();
  const { data: orders = [] } = useQuery({
    queryKey: ["maintenance-orders"],
    queryFn: () => listResource<MaintenanceOrder>("/maintenance/orders"),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles(),
  });
  const createOrderMutation = useMutation({
    mutationFn: createMaintenanceOrder,
    onSuccess: async () => {
      setIsModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["maintenance-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => setFormError("Não foi possivel criar a ordem de servico."),
  });
  const updateOrderMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => updateMaintenanceOrder(id, payload),
    onSuccess: async () => {
      closeModal();
      await invalidateMaintenanceData();
    },
    onError: (error) =>
      setFormError(
        apiErrorMessage(error, "Não foi possivel editar a ordem de servico."),
      ),
  });
  const deleteOrderMutation = useMutation({
    mutationFn: deleteMaintenanceOrder,
    onSuccess: invalidateMaintenanceData,
    onError: (error) =>
      setFormError(
        apiErrorMessage(error, "Não foi possivel excluir a ordem de servico."),
      ),
  });

  async function invalidateMaintenanceData() {
    await queryClient.invalidateQueries({ queryKey: ["maintenance-orders"] });
    await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  function openCreateModal() {
    setEditingOrder(undefined);
    setFormError(undefined);
    setIsModalOpen(true);
  }

  function openEditModal(order: MaintenanceOrder) {
    setEditingOrder(order);
    setFormError(undefined);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingOrder(undefined);
    setFormError(undefined);
  }

  const chartData = [
    {
      status: "Aberta",
      total: orders.filter((order) => order.status === "open").length,
    },
    {
      status: "Agendada",
      total: orders.filter((order) => order.status === "scheduled").length,
    },
    {
      status: "Execucao",
      total: orders.filter((order) => order.status === "in_progress").length,
    },
    {
      status: "Fechada",
      total: orders.filter((order) => order.status === "closed").length,
    },
  ];
  const vehicleOptions = vehicles.map((vehicle) => ({
    value: vehicle._id,
    label: `${vehicle.plate} - ${vehicle.nickname ?? vehicle.model}`,
    searchText: `${vehicle.plate} ${vehicle.nickname ?? ""} ${vehicle.brand} ${vehicle.model}`,
  }));

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Manutenção</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Preventivas, corretivas, historico de custos, anexos e ordens de
            servico.
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Wrench size={18} />
          Nova OS
        </Button>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Ordens de servico</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Tipo</Th>
                  <Th>Prioridade</Th>
                  <Th>Status</Th>
                  <Th>Agendamento</Th>
                  <Th>Custo</Th>
                  <Th>Anexos</Th>
                  <Th>Acoes</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <ClipboardList size={16} className="text-fleet-green" />
                        <strong>
                          {labelFor(order.type, maintenanceTypeLabels)}
                        </strong>
                      </div>
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          order.priority === "high"
                            ? "red"
                            : order.priority === "medium"
                              ? "amber"
                              : "green"
                        }
                      >
                        {labelFor(order.priority, priorityLabels)}
                      </Badge>
                    </Td>
                    <Td>{labelFor(order.status, maintenanceStatusLabels)}</Td>
                    <Td>{formatDate(order.scheduledAt)}</Td>
                    <Td>{formatCurrency(order.totalCost)}</Td>
                    <Td>
                      <Paperclip size={16} className="text-zinc-500" />
                    </Td>
                    <Td>
                      <ActionMenu
                        items={[
                          {
                            label: "Editar",
                            icon: <Edit2 size={15} />,
                            onClick: () => openEditModal(order),
                          },
                          {
                            label: "Detalhes",
                            icon: <Eye size={15} />,
                            onClick: () => setDetailOrder(order),
                          },
                          {
                            label: "Excluir",
                            icon: <Trash2 size={15} />,
                            danger: true,
                            disabled: deleteOrderMutation.isPending,
                            onClick: () => {
                              if (
                                window.confirm("Excluir esta ordem de servico?")
                              ) {
                                deleteOrderMutation.mutate(order._id);
                              }
                            },
                          },
                        ]}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Calendario operacional</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Proximas execucoes e backlog por status.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-5 grid grid-cols-2 gap-3">
              {orders.map((order) => (
                <div
                  key={order._id}
                  className="rounded-lg border border-fleet-line p-3"
                >
                  <CalendarDays size={17} className="text-fleet-cyan" />
                  <strong className="mt-2 block text-sm">
                    {formatDate(order.scheduledAt)}
                  </strong>
                  <span className="text-xs text-zinc-500">
                    {labelFor(order.type, maintenanceTypeLabels)}
                  </span>
                </div>
              ))}
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="status" tickLine={false} axisLine={false} />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Bar dataKey="total" fill="#027f9f" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      <Modal
        open={isModalOpen}
        title={
          editingOrder ? "Editar ordem de servico" : "Nova ordem de servico"
        }
        description="Abra uma manutenção preventiva, corretiva ou preditiva para um veiculo."
        onClose={closeModal}
      >
        <form
          className="space-y-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            setFormError(undefined);
            const form = new FormData(event.currentTarget);
            const vehicleId = String(form.get("vehicleId") ?? "");
            if (!vehicleId) {
              setFormError("Selecione o veiculo da ordem de servico.");
              return;
            }
            const payload = {
              vehicleId,
              type: String(form.get("type") ?? "preventive"),
              priority: String(form.get("priority") ?? "medium"),
              status: String(form.get("status") ?? "open"),
              scheduledAt: String(form.get("scheduledAt") ?? "") || undefined,
              odometerKm: Number(form.get("odometerKm") || 0),
              totalCost: Number(form.get("totalCost") || 0),
            };
            if (editingOrder) {
              updateOrderMutation.mutate({ id: editingOrder._id, payload });
              return;
            }
            createOrderMutation.mutate(payload);
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Veiculo
              <SearchableSelect
                name="vehicleId"
                required
                defaultValue={editingOrder?.vehicleId ?? ""}
                placeholder="Selecione"
                searchPlaceholder="Buscar placa, modelo ou apelido"
                options={vehicleOptions}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Tipo
              <SearchableSelect
                name="type"
                defaultValue={editingOrder?.type ?? "preventive"}
                options={maintenanceTypeOptions}
                searchPlaceholder="Buscar tipo"
                searchable={false}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Prioridade
              <SearchableSelect
                name="priority"
                defaultValue={editingOrder?.priority ?? "medium"}
                options={priorityOptions}
                searchPlaceholder="Buscar prioridade"
                searchable={false}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Status
              <SearchableSelect
                name="status"
                defaultValue={editingOrder?.status ?? "open"}
                options={maintenanceStatusOptions}
                searchPlaceholder="Buscar status"
                searchable={false}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Agendamento
              <Input
                name="scheduledAt"
                type="datetime-local"
                defaultValue={editingOrder?.scheduledAt?.slice(0, 16)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Odometro
              <Input
                name="odometerKm"
                type="number"
                min="0"
                defaultValue={editingOrder?.odometerKm ?? 0}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Custo previsto
              <Input
                name="totalCost"
                type="number"
                min="0"
                step="0.01"
                defaultValue={editingOrder?.totalCost ?? 0}
              />
            </label>
          </div>
          {formError && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                createOrderMutation.isPending || updateOrderMutation.isPending
              }
            >
              {createOrderMutation.isPending || updateOrderMutation.isPending
                ? "Salvando..."
                : "Salvar OS"}
            </Button>
          </div>
        </form>
      </Modal>

      <DetailModal
        open={Boolean(detailOrder)}
        entityId={detailOrder?._id}
        title="Detalhes da ordem de servico"
        description="Dados da manutenção, custo e historico de auditoria."
        onClose={() => setDetailOrder(undefined)}
        fields={[
          {
            label: "Veiculo",
            value: detailOrder?.vehicleId
              ? (vehicles.find(
                  (vehicle) => vehicle._id === detailOrder.vehicleId,
                )?.plate ?? detailOrder.vehicleId)
              : undefined,
          },
          {
            label: "Tipo",
            value: labelFor(detailOrder?.type, maintenanceTypeLabels),
          },
          {
            label: "Prioridade",
            value: labelFor(detailOrder?.priority, priorityLabels),
          },
          {
            label: "Status",
            value: labelFor(detailOrder?.status, maintenanceStatusLabels),
          },
          { label: "Agendamento", value: formatDate(detailOrder?.scheduledAt) },
          {
            label: "Odometro",
            value: detailOrder?.odometerKm
              ? `${detailOrder.odometerKm.toLocaleString("pt-BR")} km`
              : "-",
          },
          {
            label: "Custo",
            value: detailOrder
              ? formatCurrency(detailOrder.totalCost)
              : undefined,
          },
        ]}
      >
        <div className="rounded-lg border border-fleet-line p-4">
          <strong className="block text-sm text-fleet-ink">Anexos</strong>
          <div className="mt-3 space-y-2">
            {(detailOrder?.attachments?.length ?? 0) === 0 && (
              <p className="text-sm text-zinc-500">
                Nenhum anexo vinculado a esta ordem.
              </p>
            )}
            {detailOrder?.attachments?.map((url) => (
              <button
                key={url}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-md border border-fleet-line px-3 py-2 text-left text-sm transition hover:bg-zinc-50"
                onClick={() =>
                  setPreviewAttachment({
                    fileName: url.split("/").pop() || "anexo",
                    url,
                  })
                }
              >
                <span className="break-all font-medium text-fleet-ink">
                  {url.split("/").pop() || url}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  Previsualizar
                </span>
              </button>
            ))}
          </div>
        </div>
      </DetailModal>

      <AttachmentPreviewModal
        open={Boolean(previewAttachment)}
        title="Previsualizar anexo"
        fileName={previewAttachment?.fileName ?? ""}
        url={previewAttachment?.url}
        onClose={() => setPreviewAttachment(undefined)}
        onDownload={() => {
          if (previewAttachment) {
            downloadExternalFile(
              previewAttachment.url,
              previewAttachment.fileName,
            );
          }
        }}
      />
    </div>
  );
}
