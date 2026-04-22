import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ClipboardList,
  Download,
  Edit2,
  Eye,
  Filter,
  Paperclip,
  Search,
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
import { FilterField, FilterPanel } from "../../components/ui/filter-panel";
import { Input } from "../../components/ui/input";
import { Modal } from "../../components/ui/modal";
import { SearchableSelect } from "../../components/ui/searchable-select";
import { Table, Td, Th } from "../../components/ui/table";
import {
  apiErrorMessage,
  createMaintenanceOrder,
  deleteMaintenanceOrder,
  downloadResourceExport,
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
  { value: "medium", label: "MÃ©dia" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Critica" },
];

const maintenanceStatusOptions = [
  { value: "open", label: "Aberta" },
  { value: "scheduled", label: "Agendada" },
  { value: "in_progress", label: "Em execução" },
  { value: "closed", label: "Finalizada" },
  { value: "cancelled", label: "Cancelada" },
];

export function MaintenancePage() {
  const queryClient = useQueryClient();
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<MaintenanceOrder>();
  const [detailOrder, setDetailOrder] = useState<MaintenanceOrder>();
  const [formError, setFormError] = useState<string>();
  const [filters, setFilters] = useState({
    search: "",
    vehicleId: "",
    type: "",
    priority: "",
    status: "",
    from: "",
    to: "",
    showClosed: false,
  });
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
    onError: () => setFormError("Não foi possível criar a ordem de serviço."),
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
        apiErrorMessage(error, "Não foi possível editar a ordem de serviço."),
      ),
  });
  const deleteOrderMutation = useMutation({
    mutationFn: deleteMaintenanceOrder,
    onSuccess: invalidateMaintenanceData,
    onError: (error) =>
      setFormError(
        apiErrorMessage(error, "Não foi possível excluir a ordem de serviço."),
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

  const vehicleOptions = vehicles.map((vehicle) => ({
    value: vehicle._id,
    label: `${vehicle.plate} - ${vehicle.nickname ?? vehicle.model}`,
    searchText: `${vehicle.plate} ${vehicle.nickname ?? ""} ${vehicle.brand} ${vehicle.model}`,
  }));
  const filteredOrders = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return orders.filter((order) => {
      const vehicleText = vehicleOptions.find((vehicle) => vehicle.value === order.vehicleId)?.searchText?.toLowerCase() ?? "";
      const scheduledAt = order.scheduledAt?.slice(0, 10) ?? "";
      const hideClosed = !filters.showClosed && !filters.status;
      return (
        (!term || vehicleText.includes(term) || String(order.type).toLowerCase().includes(term)) &&
        (!filters.vehicleId || order.vehicleId === filters.vehicleId) &&
        (!filters.type || order.type === filters.type) &&
        (!filters.priority || order.priority === filters.priority) &&
        (!filters.status || order.status === filters.status) &&
        (!hideClosed || order.status !== "closed") &&
        (!filters.from || scheduledAt >= filters.from) &&
        (!filters.to || scheduledAt <= filters.to)
      );
    });
  }, [orders, filters, vehicleOptions]);

  const chartData = [
    {
      status: "Aberta",
      total: filteredOrders.filter((order) => order.status === "open").length,
    },
    {
      status: "Agendada",
      total: filteredOrders.filter((order) => order.status === "scheduled").length,
    },
    {
      status: "Execucao",
      total: filteredOrders.filter((order) => order.status === "in_progress").length,
    },
    {
      status: "Finalizada",
      total: filteredOrders.filter((order) => order.status === "closed").length,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Manutenção</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Preventivas, corretivas, histórico de custos, anexos e ordens de
            serviço.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => downloadResourceExport("maintenance-orders")}
          >
            <Download size={18} />
            Exportar CSV
          </Button>
          <Button onClick={openCreateModal}>
            <Wrench size={18} />
            Nova OS
          </Button>
        </div>
      </section>

      <FilterPanel
        description="Refine ordens por veí­culo, tipo, prioridade, status e período."
        isExpanded={filtersExpanded}
        onToggleExpanded={() => setFiltersExpanded((current) => !current)}
        searchSlot={
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-zinc-400" size={18} />
            <Input className="pl-10" placeholder="Buscar veículo ou tipo" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
          </div>
        }
        expandedContent={
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FilterField label="Veículo">
                <SearchableSelect value={filters.vehicleId} onValueChange={(value) => setFilters((current) => ({ ...current, vehicleId: value }))} placeholder="Todos os veículos" searchPlaceholder="Buscar veículo" options={[{ value: "", label: "Veículos" }, ...vehicleOptions]} />
              </FilterField>
              <FilterField label="Tipo">
                <SearchableSelect value={filters.type} onValueChange={(value) => setFilters((current) => ({ ...current, type: value }))} placeholder="Todos" options={[{ value: "", label: "Todos" }, ...maintenanceTypeOptions]} />
              </FilterField>
              <FilterField label="Prioridade">
                <SearchableSelect value={filters.priority} onValueChange={(value) => setFilters((current) => ({ ...current, priority: value }))} placeholder="Todas" options={[{ value: "", label: "Todas" }, ...priorityOptions]} />
              </FilterField>
              <FilterField label="Status">
                <SearchableSelect value={filters.status} onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))} placeholder="Todos" options={[{ value: "", label: "Todos" }, ...maintenanceStatusOptions]} />
              </FilterField>
              <FilterField label="Fechadas">
                <label className="flex h-11 items-center gap-3 rounded-lg border border-fleet-line bg-white px-3 text-sm font-medium text-fleet-ink">
                  <input
                    type="checkbox"
                    checked={filters.showClosed}
                    onChange={(event) => setFilters((current) => ({ ...current, showClosed: event.target.checked }))}
                    className="h-4 w-4 accent-fleet-green"
                  />
                  <span>Mostrar fechadas</span>
                </label>
              </FilterField>
              <FilterField label="Data inicial">
                <Input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} />
              </FilterField>
              <FilterField label="Data final">
                <Input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} />
              </FilterField>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setFilters({ search: "", vehicleId: "", type: "", priority: "", status: "", from: "", to: "", showClosed: false })}>
                <Filter size={18} />
                Limpar filtros
              </Button>
            </div>
          </div>
        }
      >
        {null}
      </FilterPanel>

      <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Ordens de serviço</CardTitle>
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
                  <Th>AÃ§Ãµes</Th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
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
                    <Td>
                      <SearchableSelect
                        value={order.status}
                        onValueChange={(value) =>
                          updateOrderMutation.mutate({
                            id: order._id,
                            payload: { status: value },
                          })
                        }
                        options={maintenanceStatusOptions}
                        searchable={false}
                        className="min-w-[150px]"
                      />
                    </Td>
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
                                window.confirm("Excluir esta ordem de serviço?")
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
              {filteredOrders.map((order) => (
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
          editingOrder ? "Editar ordem de serviço" : "Nova ordem de serviço"
        }
        description="Abra uma manutenção preventiva, corretiva ou preditiva para um veículo."
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
              setFormError("Selecione o veículo da ordem de serviço.");
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
              veículo
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
              Odômetro
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
        title="Detalhes da ordem de serviço"
        description="Dados da manutenção, custo e histórico de auditoria."
        onClose={() => setDetailOrder(undefined)}
        fields={[
          {
            label: "veículo",
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
            label: "Odômetro",
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
          <strong className="block text-sm text-fleet-ink">Status</strong>
          <div className="mt-3 max-w-[240px]">
            <SearchableSelect
              value={detailOrder?.status ?? "open"}
              onValueChange={(value) => {
                if (!detailOrder) {
                  return;
                }
                updateOrderMutation.mutate({
                  id: detailOrder._id,
                  payload: { status: value },
                });
                setDetailOrder((current) =>
                  current ? { ...current, status: value } : current,
                );
              }}
              options={maintenanceStatusOptions}
              searchable={false}
            />
          </div>
        </div>
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

