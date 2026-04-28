import { FormEvent, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
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
  X,
  Plus,
} from "lucide-react";
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
  deleteMaintenanceOrderAttachment,
  deleteMaintenanceOrder,
  downloadMaintenanceOrderAttachment,
  downloadResourceExport,
  fetchMaintenanceOrderAttachmentBlob,
  getSettingsParameters,
  getVehicles,
  listResource,
  uploadMaintenanceOrderAttachment,
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
  // { value: "predictive", label: "Preditiva" },
];

const priorityOptions = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
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

const maintenanceProgressStatusOptions = maintenanceStatusOptions.filter(
  (option) => !["closed", "scheduled"].includes(option.value),
);

const calendarWeekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

export function MaintenancePage() {
  const queryClient = useQueryClient();
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<MaintenanceOrder>();
  const [finalizingOrder, setFinalizingOrder] = useState<MaintenanceOrder>();
  const [detailOrder, setDetailOrder] = useState<MaintenanceOrder>();
  const [formError, setFormError] = useState<string>();
  const [finalizeError, setFinalizeError] = useState<string>();
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
  const [calendarMonth, setCalendarMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(
    () => new Date(),
  );
  const [previewAttachment, setPreviewAttachment] = useState<{
    objectUrl?: string;
    fileName: string;
    orderId: string;
    url?: string;
  }>();
  const [attachmentFile, setAttachmentFile] = useState<File>();
  const [finalizeLaborCost, setFinalizeLaborCost] = useState(0);
  const [maintenanceItems, setMaintenanceItems] = useState<
    Array<{
      id: string;
      name: string;
      category: "part" | "service";
      costCenter: string;
      quantity: number;
      unitCost: number;
    }>
  >([]);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const { data: orders = [] } = useQuery({
    queryKey: ["maintenance-orders"],
    queryFn: () => listResource<MaintenanceOrder>("/maintenance/orders"),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles(),
  });
  const { data: settingsParameters = [] } = useQuery({
    queryKey: ["settings-parameters"],
    queryFn: () => getSettingsParameters(),
  });
  const createOrderMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const created = await createMaintenanceOrder(payload);
      if (attachmentFile) {
        return uploadMaintenanceOrderAttachment(created._id, attachmentFile);
      }
      return created;
    },
    onSuccess: async () => {
      closeModal();
      await invalidateMaintenanceData();
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
    }) =>
      updateMaintenanceOrder(id, payload).then((updated) => {
        if (!attachmentFile) {
          return updated;
        }
        return uploadMaintenanceOrderAttachment(id, attachmentFile);
      }),
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
  const deleteAttachmentMutation = useMutation({
    mutationFn: ({
      orderId,
      fileName,
    }: {
      orderId: string;
      fileName: string;
    }) => deleteMaintenanceOrderAttachment(orderId, fileName),
    onSuccess: async (updated) => {
      setEditingOrder((current) =>
        current?._id === updated._id ? updated : current,
      );
      setFinalizingOrder((current) =>
        current?._id === updated._id ? updated : current,
      );
      setDetailOrder((current) =>
        current?._id === updated._id ? updated : current,
      );
      await invalidateMaintenanceData();
    },
    onError: (error) => {
      const message = apiErrorMessage(
        error,
        "Nao foi possivel remover o anexo da OS.",
      );
      setFormError(message);
      setFinalizeError(message);
    },
  });

  async function invalidateMaintenanceData() {
    await queryClient.invalidateQueries({ queryKey: ["maintenance-orders"] });
    await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  function openCreateModal() {
    setEditingOrder(undefined);
    setFinalizingOrder(undefined);
    setFormError(undefined);
    setFinalizeError(undefined);
    setAttachmentFile(undefined);
    setFinalizeLaborCost(0);
    setMaintenanceItems([]);
    setIsModalOpen(true);
  }

  function openEditModal(order: MaintenanceOrder) {
    if (order.status === "closed") {
      setFormError("Ordens de serviço finalizadas não podem ser editadas.");
      return;
    }
    setEditingOrder(order);
    setFinalizingOrder(undefined);
    setFormError(undefined);
    setAttachmentFile(undefined);
    setFinalizeLaborCost(0);
    setMaintenanceItems(
      (order.items ?? []).map((item, index) => ({
        id: `${order._id}-${index}`,
        name: item.name ?? "",
        category: item.category === "part" ? "part" : "service",
        costCenter: item.costCenter ?? "",
        quantity: Number(item.quantity ?? 1),
        unitCost: Number(item.unitCost ?? 0),
      })),
    );
    setIsModalOpen(true);
  }

  function openFinalizeModal(order: MaintenanceOrder) {
    setFinalizingOrder(order);
    setEditingOrder(undefined);
    setFormError(undefined);
    setFinalizeError(undefined);
    setAttachmentFile(undefined);
    setFinalizeLaborCost(Number(order.laborCost ?? 0));
    setMaintenanceItems(
      (order.items ?? []).map((item, index) => ({
        id: `${order._id}-finalize-${index}`,
        name: item.name ?? "",
        category: item.category === "part" ? "part" : "service",
        costCenter: item.costCenter ?? "",
        quantity: Number(item.quantity ?? 1),
        unitCost: Number(item.unitCost ?? 0),
      })),
    );
    setIsFinalizeModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingOrder(undefined);
    setFormError(undefined);
    setAttachmentFile(undefined);
    setFinalizeLaborCost(0);
    setMaintenanceItems([]);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  }

  function handleDeleteExistingAttachment(orderId: string, url: string) {
    const fileName = attachmentFileNameFromUrl(url);
    if (!window.confirm(`Excluir o anexo ${fileName}?`)) {
      return;
    }
    deleteAttachmentMutation.mutate({ orderId, fileName });
  }

  function closeFinalizeModal() {
    setIsFinalizeModalOpen(false);
    setFinalizingOrder(undefined);
    setFinalizeError(undefined);
    setFinalizeLaborCost(0);
    setMaintenanceItems([]);
  }

  function attachmentFileNameFromUrl(url: string) {
    return decodeURIComponent(url.split("/").pop() || "anexo");
  }

  async function openAttachmentPreview(orderId: string, url: string) {
    const fileName = attachmentFileNameFromUrl(url);
    try {
      const blob = await fetchMaintenanceOrderAttachmentBlob(orderId, fileName);
      const objectUrl = window.URL.createObjectURL(blob);
      setPreviewAttachment({
        orderId,
        fileName,
        url: objectUrl,
        objectUrl,
      });
    } catch (error) {
      setFormError(
        apiErrorMessage(error, "Não foi possível abrir o anexo da OS."),
      );
    }
  }

  function closeAttachmentPreview() {
    if (previewAttachment?.objectUrl) {
      window.URL.revokeObjectURL(previewAttachment.objectUrl);
    }
    setPreviewAttachment(undefined);
  }

  function moveCalendarMonth(direction: "prev" | "next") {
    const nextMonth =
      direction === "prev"
        ? subMonths(calendarMonth, 1)
        : addMonths(calendarMonth, 1);
    setCalendarMonth(nextMonth);
    setSelectedCalendarDate(startOfMonth(nextMonth));
  }

  function addMaintenanceItem() {
    setMaintenanceItems((current) => [
      ...current,
      {
        id: `${Date.now()}-${current.length}`,
        name: "",
        category: "service",
        costCenter: "",
        quantity: 1,
        unitCost: 0,
      },
    ]);
  }

  function updateMaintenanceItem(
    id: string,
    field: "name" | "category" | "costCenter" | "quantity" | "unitCost",
    value: string | number,
  ) {
    setMaintenanceItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  }

  function removeMaintenanceItem(id: string) {
    setMaintenanceItems((current) => current.filter((item) => item.id !== id));
  }

  const vehicleOptions = vehicles.map((vehicle) => ({
    value: vehicle._id,
    label: `${vehicle.plate} - ${vehicle.nickname ?? vehicle.model}`,
    searchText: `${vehicle.plate} ${vehicle.nickname ?? ""} ${vehicle.brand} ${vehicle.model}`,
  }));
  const maintenanceCostCenters =
    (settingsParameters.find((item) => item.key === "maintenance.cost_centers")
      ?.value as string[] | undefined) ?? [];
  const maintenanceServices =
    (settingsParameters.find(
      (item) => item.key === "maintenance.services_catalog",
    )?.value as string[] | undefined) ?? [];
  const maintenanceGroups =
    (settingsParameters.find((item) => item.key === "maintenance.parts_catalog")
      ?.value as string[] | undefined) ?? [];
  const filteredOrders = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return orders.filter((order) => {
      const vehicleText =
        vehicleOptions
          .find((vehicle) => vehicle.value === order.vehicleId)
          ?.searchText?.toLowerCase() ?? "";
      const scheduledAt = order.scheduledAt?.slice(0, 10) ?? "";
      const hideClosed = !filters.showClosed && !filters.status;
      return (
        (!term ||
          vehicleText.includes(term) ||
          String(order.type).toLowerCase().includes(term)) &&
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

  const ordersWithSchedule = useMemo(
    () =>
      filteredOrders
        .filter((order) => order.scheduledAt)
        .map((order) => ({
          ...order,
          scheduledDate: parseISO(String(order.scheduledAt)),
        })),
    [filteredOrders],
  );

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    });
  }, [calendarMonth]);

  const ordersByDay = useMemo(() => {
    const map = new Map<string, MaintenanceOrder[]>();
    for (const order of ordersWithSchedule) {
      const key = format(order.scheduledDate, "yyyy-MM-dd");
      const current = map.get(key) ?? [];
      current.push(order);
      map.set(key, current);
    }
    return map;
  }, [ordersWithSchedule]);

  const selectedDayOrders = useMemo(() => {
    const key = format(selectedCalendarDate, "yyyy-MM-dd");
    const current = [...(ordersByDay.get(key) ?? [])];
    return current.sort((left, right) => {
      const leftToday = isToday(parseISO(String(left.scheduledAt)));
      const rightToday = isToday(parseISO(String(right.scheduledAt)));
      if (leftToday !== rightToday) {
        return leftToday ? -1 : 1;
      }
      const leftPriority =
        left.priority === "critical"
          ? 0
          : left.priority === "high"
            ? 1
            : left.priority === "medium"
              ? 2
              : 3;
      const rightPriority =
        right.priority === "critical"
          ? 0
          : right.priority === "high"
            ? 1
            : right.priority === "medium"
              ? 2
              : 3;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return (
        parseISO(String(left.scheduledAt)).getTime() -
        parseISO(String(right.scheduledAt)).getTime()
      );
    });
  }, [ordersByDay, selectedCalendarDate]);

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
        description="Refine ordens por veículo, tipo, prioridade, status e período."
        isExpanded={filtersExpanded}
        onToggleExpanded={() => setFiltersExpanded((current) => !current)}
        searchSlot={
          <div className="relative">
            <Search
              className="absolute left-3 top-2.5 text-zinc-400"
              size={18}
            />
            <Input
              className="pl-10"
              placeholder="Buscar veículo ou tipo"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
            />
          </div>
        }
        expandedContent={
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FilterField label="Veículo">
                <SearchableSelect
                  value={filters.vehicleId}
                  onValueChange={(value) =>
                    setFilters((current) => ({ ...current, vehicleId: value }))
                  }
                  placeholder="Todos os veículos"
                  searchPlaceholder="Buscar veículo"
                  options={[
                    { value: "", label: "Veículos" },
                    ...vehicleOptions,
                  ]}
                />
              </FilterField>
              <FilterField label="Tipo">
                <SearchableSelect
                  value={filters.type}
                  onValueChange={(value) =>
                    setFilters((current) => ({ ...current, type: value }))
                  }
                  placeholder="Todos"
                  options={[
                    { value: "", label: "Todos" },
                    ...maintenanceTypeOptions,
                  ]}
                />
              </FilterField>
              <FilterField label="Prioridade">
                <SearchableSelect
                  value={filters.priority}
                  onValueChange={(value) =>
                    setFilters((current) => ({ ...current, priority: value }))
                  }
                  placeholder="Todas"
                  options={[{ value: "", label: "Todas" }, ...priorityOptions]}
                />
              </FilterField>
              <FilterField label="Status">
                <SearchableSelect
                  value={filters.status}
                  onValueChange={(value) =>
                    setFilters((current) => ({ ...current, status: value }))
                  }
                  placeholder="Todos"
                  options={[
                    { value: "", label: "Todos" },
                    ...maintenanceStatusOptions,
                  ]}
                />
              </FilterField>
              <FilterField label="Fechadas">
                <label className="flex h-11 items-center gap-3 rounded-lg border border-fleet-line bg-white px-3 text-sm font-medium text-fleet-ink">
                  <input
                    type="checkbox"
                    checked={filters.showClosed}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        showClosed: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-fleet-green"
                  />
                  <span>Mostrar fechadas</span>
                </label>
              </FilterField>
              <FilterField label="Data inicial">
                <Input
                  type="date"
                  value={filters.from}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      from: event.target.value,
                    }))
                  }
                />
              </FilterField>
              <FilterField label="Data final">
                <Input
                  type="date"
                  value={filters.to}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      to: event.target.value,
                    }))
                  }
                />
              </FilterField>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  setFilters({
                    search: "",
                    vehicleId: "",
                    type: "",
                    priority: "",
                    status: "",
                    from: "",
                    to: "",
                    showClosed: false,
                  })
                }
              >
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
                  <Th>Ações</Th>
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
                      {order.status === "closed" ? (
                        <Badge tone="green">
                          {labelFor(order.status, maintenanceStatusLabels)}
                        </Badge>
                      ) : (
                        <SearchableSelect
                          value={order.status}
                          onValueChange={(value) => {
                            if (value === "closed") {
                              openFinalizeModal(order);
                              return;
                            }
                            updateOrderMutation.mutate({
                              id: order._id,
                              payload: { status: value },
                            });
                          }}
                          options={maintenanceProgressStatusOptions}
                          searchable={false}
                          className="min-w-[150px]"
                        />
                      )}
                    </Td>
                    <Td>{formatDate(order.scheduledAt)}</Td>
                    <Td>{formatCurrency(order.totalCost)}</Td>
                    <Td>
                      <div className="flex items-center gap-2 text-zinc-500">
                        <Paperclip size={16} className="text-zinc-500" />
                        <span>{order.attachments?.length ?? 0}</span>
                      </div>
                    </Td>
                    <Td>
                      <ActionMenu
                        items={[
                          {
                            label: "Detalhes",
                            icon: <Eye size={15} />,
                            onClick: () => setDetailOrder(order),
                          },
                          ...(order.status !== "closed"
                            ? [
                                {
                                  label: "Editar",
                                  icon: <Edit2 size={15} />,
                                  onClick: () => openEditModal(order),
                                },
                              ]
                            : []),
                          ...(order.status !== "closed"
                            ? [
                                {
                                  label: "Finalizar OS",
                                  icon: <Wrench size={15} />,
                                  onClick: () => openFinalizeModal(order),
                                },
                              ]
                            : []),
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
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Calendário operacional</CardTitle>
                  <p className="mt-1 text-sm text-zinc-500">
                    Agenda mensal com ordens por data e prioridade operacional.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 rounded-lg border border-fleet-line bg-zinc-50 p-1">
                  <button
                    type="button"
                    className="rounded-md p-2 text-zinc-500 transition hover:bg-white hover:text-fleet-green"
                    onClick={() => moveCalendarMonth("prev")}
                    aria-label="Mês anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="min-w-[132px] px-2 text-center text-sm font-semibold text-fleet-ink">
                    {format(calendarMonth, "MMMM yyyy", { locale: ptBR })}
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-2 text-zinc-500 transition hover:bg-white hover:text-fleet-green"
                    onClick={() => moveCalendarMonth("next")}
                    aria-label="Próximo mês"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                {calendarWeekDays.map((day) => (
                  <span key={day} className="py-1">
                    {day}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayOrders = ordersByDay.get(key) ?? [];
                  const isSelected = isSameDay(day, selectedCalendarDate);
                  const hasTodayDue = dayOrders.some((order) =>
                    isToday(parseISO(String(order.scheduledAt))),
                  );
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedCalendarDate(day)}
                      className={[
                        "min-h-[78px] rounded-xl border p-2 text-left transition",
                        isSelected
                          ? "border-fleet-green bg-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]"
                          : "border-fleet-line bg-white hover:border-emerald-200 hover:bg-zinc-50",
                        !isSameMonth(day, calendarMonth) ? "opacity-45" : "",
                        hasTodayDue ? "animate-pulse" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={[
                            "text-sm font-semibold",
                            isToday(day)
                              ? "text-fleet-green"
                              : "text-fleet-ink",
                          ].join(" ")}
                        >
                          {format(day, "d")}
                        </span>
                        {dayOrders.length > 0 && (
                          <span className="rounded-full bg-fleet-green/10 px-2 py-0.5 text-[10px] font-semibold text-fleet-green">
                            {dayOrders.length}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 space-y-1">
                        {dayOrders.slice(0, 2).map((order) => (
                          <div
                            key={order._id}
                            className={[
                              "truncate rounded-md px-2 py-1 text-[11px] font-medium",
                              order.priority === "critical" ||
                              order.priority === "high"
                                ? "bg-red-50 text-red-700"
                                : order.priority === "medium"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-emerald-50 text-emerald-700",
                            ].join(" ")}
                          >
                            {vehicles.find(
                              (vehicle) => vehicle._id === order.vehicleId,
                            )?.plate ?? order.vehicleId}
                          </div>
                        ))}
                        {dayOrders.length > 2 && (
                          <div className="text-[10px] font-medium text-zinc-500">
                            +{dayOrders.length - 2} OS
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-fleet-line bg-zinc-50/80 px-4 py-3">
              <div>
                <strong className="block text-sm text-fleet-ink">
                  {format(selectedCalendarDate, "EEEE, d 'de' MMMM", {
                    locale: ptBR,
                  })}
                </strong>
                <span className="mt-1 block text-xs text-zinc-500">
                  {selectedDayOrders.length} ordem(ns) planejada(s) para a data
                  selecionada.
                </span>
              </div>
              {isToday(selectedCalendarDate) && (
                <Badge tone="green">Hoje</Badge>
              )}
            </div>
            <div className="space-y-3">
              {selectedDayOrders.length === 0 && (
                <div className="rounded-xl border border-dashed border-fleet-line px-4 py-8 text-center text-sm text-zinc-500">
                  Nenhuma ordem agendada para esta data.
                </div>
              )}
              {selectedDayOrders.map((order) => {
                const dueToday = isToday(parseISO(String(order.scheduledAt)));
                const vehicle = vehicles.find(
                  (item) => item._id === order.vehicleId,
                );
                return (
                  <div
                    key={order._id}
                    className={[
                      "rounded-xl border px-4 py-3 shadow-[0_10px_25px_rgba(15,23,42,0.04)]",
                      dueToday
                        ? "order-first animate-pulse border-amber-300 bg-amber-50/80"
                        : "border-fleet-line bg-white",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <strong className="block truncate text-sm text-fleet-ink">
                          {vehicle?.plate ?? order.vehicleId} -{" "}
                          {labelFor(order.type, maintenanceTypeLabels)}
                        </strong>
                        <span className="mt-1 block text-xs text-zinc-500">
                          {vehicle?.nickname ??
                            vehicle?.model ??
                            "Veículo sem apelido"}
                        </span>
                      </div>
                      <Badge
                        tone={
                          order.priority === "critical" ||
                          order.priority === "high"
                            ? "red"
                            : order.priority === "medium"
                              ? "amber"
                              : "green"
                        }
                      >
                        {labelFor(order.priority, priorityLabels)}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span>{formatDate(order.scheduledAt)}</span>
                      <span>•</span>
                      <span>{formatCurrency(order.totalCost)}</span>
                      <span>•</span>
                      <span>
                        {labelFor(order.status, maintenanceStatusLabels)}
                      </span>
                      {dueToday && (
                        <>
                          <span>•</span>
                          <span className="font-semibold text-amber-700">
                            Vence hoje
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      <Modal
        open={isModalOpen}
        title={
          editingOrder ? "Editar ordem de serviço" : "Nova ordem de serviço"
        }
        description="Abra a manutencao com os dados iniciais do serviço."
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
              setFormError("Selecione o veiculo da ordem de serviço.");
              return;
            }
            const payload = {
              vehicleId,
              type: String(form.get("type") ?? "preventive"),
              priority: String(form.get("priority") ?? "medium"),
              status: editingOrder
                ? String(form.get("status") ?? editingOrder.status ?? "open")
                : "open",
              scheduledAt: String(form.get("scheduledAt") ?? "") || undefined,
              expectedDeliveryAt:
                String(form.get("expectedDeliveryAt") ?? "") || undefined,
              odometerKm: Number(form.get("odometerKm") || 0),
              description: String(form.get("description") ?? "") || undefined,
              observations: String(form.get("observations") ?? "") || undefined,
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
              {editingOrder ? (
                <SearchableSelect
                  name="status"
                  defaultValue={editingOrder?.status ?? "open"}
                  options={maintenanceProgressStatusOptions}
                  searchPlaceholder="Buscar status"
                  searchable={false}
                />
              ) : (
                <Input value="Aberta" readOnly />
              )}
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
              Previsao de entrega
              <Input
                name="expectedDeliveryAt"
                type="datetime-local"
                defaultValue={editingOrder?.expectedDeliveryAt?.slice(0, 16)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Odometro de entrada
              <Input
                name="odometerKm"
                type="number"
                min="0"
                defaultValue={editingOrder?.odometerKm ?? 0}
              />
            </label>
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Descrição do serviço
              <textarea
                name="description"
                defaultValue={editingOrder?.description}
                className="min-h-[110px] w-full rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-sm text-fleet-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_16px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-zinc-400 hover:border-emerald-200 focus:border-fleet-green focus:bg-white focus:ring-2 focus:ring-emerald-100"
                placeholder="Descreva o que vai ser feito nesta ordem de serviço"
              />
            </label>
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Observacoes
              <textarea
                name="observations"
                defaultValue={editingOrder?.observations}
                className="min-h-[92px] w-full rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-sm text-fleet-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_16px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-zinc-400 hover:border-emerald-200 focus:border-fleet-green focus:bg-white focus:ring-2 focus:ring-emerald-100"
                placeholder="Anotacoes operacionais e observacoes da oficina"
              />
            </label>
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Anexo
              <Input
                ref={attachmentInputRef}
                type="file"
                accept="image/*,.pdf,.xml,.txt,.csv,.xlsx,.xls,.doc,.docx"
                onChange={(event) =>
                  setAttachmentFile(event.target.files?.[0] ?? undefined)
                }
              />
              {attachmentFile && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-fleet-line bg-zinc-50 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fleet-ink">
                      {attachmentFile.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {(attachmentFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-fleet-line p-1 text-zinc-500 transition hover:bg-white hover:text-red-600"
                    onClick={() => {
                      setAttachmentFile(undefined);
                      if (attachmentInputRef.current) {
                        attachmentInputRef.current.value = "";
                      }
                    }}
                    aria-label="Remover anexo"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {editingOrder?.attachments &&
                editingOrder.attachments.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-fleet-line bg-white px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Anexos atuais
                    </p>
                    {editingOrder.attachments.map((url) => {
                      const fileName = attachmentFileNameFromUrl(url);
                      return (
                        <div
                          key={url}
                          className="flex items-center justify-between gap-3 rounded-md border border-fleet-line px-3 py-2"
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left text-sm transition hover:text-fleet-green"
                            onClick={() =>
                              void openAttachmentPreview(editingOrder._id, url)
                            }
                          >
                            <span className="block break-all font-medium text-fleet-ink">
                              {fileName}
                            </span>
                            <span className="mt-1 block text-xs text-zinc-500">
                              Previsualizar
                            </span>
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-fleet-line p-1 text-zinc-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            onClick={() =>
                              handleDeleteExistingAttachment(
                                editingOrder._id,
                                url,
                              )
                            }
                            disabled={deleteAttachmentMutation.isPending}
                            aria-label="Excluir anexo"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
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

      <Modal
        open={isFinalizeModalOpen}
        title="Finalizar ordem de serviço"
        description="Preencha o que foi feito, os itens trocados e os custos finais da OS."
        onClose={closeFinalizeModal}
      >
        <form
          className="space-y-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (!finalizingOrder) {
              return;
            }
            setFinalizeError(undefined);
            const form = new FormData(event.currentTarget);
            const completionDescription = String(
              form.get("completionDescription") ?? "",
            ).trim();
            const laborCost = Number(finalizeLaborCost || 0);
            const items = maintenanceItems
              .filter((item) => item.name.trim())
              .map((item) => ({
                name: item.name.trim(),
                category: item.category,
                costCenter: item.costCenter || undefined,
                quantity: Number(item.quantity || 1),
                unitCost: Number(item.unitCost || 0),
                totalCost:
                  Number(item.quantity || 1) * Number(item.unitCost || 0),
              }));
            const itemsTotalCost = items.reduce(
              (sum, item) => sum + Number(item.totalCost || 0),
              0,
            );
            const partsCost = items.reduce(
              (sum, item) =>
                sum +
                (item.category === "part" ? Number(item.totalCost || 0) : 0),
              0,
            );
            const totalCost = itemsTotalCost + laborCost;
            if (!completionDescription) {
              setFinalizeError("Descreva o que foi feito para finalizar a OS.");
              return;
            }
            if (
              items.length === 0 &&
              (!Number.isFinite(laborCost) || laborCost <= 0) &&
              (!Number.isFinite(partsCost) || partsCost <= 0)
            ) {
              setFinalizeError(
                "Informe os itens/servi?os executados ou os custos de m?o de obra e pe?as.",
              );
              return;
            }
            updateOrderMutation.mutate(
              {
                id: finalizingOrder._id,
                payload: {
                  status: "closed",
                  completionDescription,
                  laborCost,
                  partsCost,
                  totalCost,
                  items,
                },
              },
              {
                onSuccess: async () => {
                  closeFinalizeModal();
                  setDetailOrder(undefined);
                  await invalidateMaintenanceData();
                },
                onError: (error) => {
                  setFinalizeError(
                    apiErrorMessage(
                      error,
                      "Não foi possivel finalizar a ordem de serviço.",
                    ),
                  );
                },
              },
            );
          }}
        >
          <div className="rounded-xl border border-fleet-line bg-zinc-50/70 p-4 text-sm text-zinc-600">
            <strong className="block text-fleet-ink">
              {vehicles.find(
                (vehicle) => vehicle._id === finalizingOrder?.vehicleId,
              )?.plate ?? finalizingOrder?.vehicleId}
            </strong>
            <span className="mt-1 block">
              {finalizingOrder?.description ||
                "Sem descrição inicial cadastrada."}
            </span>
          </div>

          <label className="space-y-2 text-sm font-medium">
            Descrição do que foi feito
            <textarea
              name="completionDescription"
              defaultValue={finalizingOrder?.completionDescription}
              className="min-h-[110px] w-full rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-sm text-fleet-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_16px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-zinc-400 hover:border-emerald-200 focus:border-fleet-green focus:bg-white focus:ring-2 focus:ring-emerald-100"
              placeholder="Descreva exatamente o que foi executado na OS"
            />
          </label>

          <div className="space-y-3 rounded-xl border border-fleet-line bg-zinc-50/70 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <strong className="block text-sm text-fleet-ink">
                  Itens e serviços realizados
                </strong>
                <span className="mt-1 block text-xs text-zinc-500">
                  Adicione cada grupo ou serviço separadamente com centro de
                  custo e valor.
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={addMaintenanceItem}
              >
                <Plus size={16} />
                Adicionar item
              </Button>
            </div>

            {(maintenanceServices.length === 0 ||
              maintenanceGroups.length === 0 ||
              maintenanceCostCenters.length === 0) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Cadastre centros de custo, serviços e grupos em Configurações
                para alimentar os selects da OS.
              </div>
            )}

            {maintenanceItems.length === 0 && (
              <div className="rounded-lg border border-dashed border-fleet-line bg-white px-3 py-6 text-center text-sm text-zinc-500">
                Nenhum item lançado nesta finalização.
              </div>
            )}

            <div className="space-y-3">
              {maintenanceItems.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-fleet-line bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-fleet-ink">
                        Item {index + 1}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Grupo ou serviço utilizado na execucao.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-fleet-line text-zinc-500 transition hover:bg-red-50 hover:text-red-600"
                      onClick={() => removeMaintenanceItem(item.id)}
                      aria-label="Remover item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-2 text-sm font-medium">
                      Categoria
                      <SearchableSelect
                        searchable={false}
                        value={item.category}
                        onValueChange={(value) =>
                          updateMaintenanceItem(
                            item.id,
                            "category",
                            value as "part" | "service",
                          )
                        }
                        options={[
                          { value: "service", label: "Serviço" },
                          { value: "part", label: "Grupo" },
                        ]}
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      Centro de custo
                      <SearchableSelect
                        value={item.costCenter}
                        onValueChange={(value) =>
                          updateMaintenanceItem(item.id, "costCenter", value)
                        }
                        placeholder="Selecione"
                        searchPlaceholder="Buscar centro de custo"
                        options={maintenanceCostCenters.map((center) => ({
                          value: center,
                          label: center,
                          searchText: center,
                        }))}
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium md:col-span-2">
                      {item.category === "part" ? "Grupo" : "Serviço"}
                      <SearchableSelect
                        value={item.name}
                        onValueChange={(value) =>
                          updateMaintenanceItem(item.id, "name", value)
                        }
                        placeholder="Selecione"
                        searchPlaceholder={
                          item.category === "part"
                            ? "Buscar grupo"
                            : "Buscar serviço"
                        }
                        options={(item.category === "part"
                          ? maintenanceGroups
                          : maintenanceServices
                        ).map((name) => ({
                          value: name,
                          label: name,
                          searchText: name,
                        }))}
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      Quantidade
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateMaintenanceItem(
                            item.id,
                            "quantity",
                            Number(event.target.value || 1),
                          )
                        }
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      Valor unitario
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitCost}
                        onChange={(event) =>
                          updateMaintenanceItem(
                            item.id,
                            "unitCost",
                            Number(event.target.value || 0),
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-lg border border-fleet-line bg-zinc-50 px-3 py-2 text-sm">
                    <span className="text-zinc-500">Total do item</span>
                    <strong className="text-fleet-ink">
                      {formatCurrency(item.quantity * item.unitCost)}
                    </strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                Valor de mão de obra
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={finalizeLaborCost}
                  onChange={(event) =>
                    setFinalizeLaborCost(Number(event.target.value || 0))
                  }
                />
              </label>
              {/* <label className="space-y-2 text-sm font-medium">
                Valor total dos grupos
                <Input
                  name="partsCost"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={finalizingOrder?.partsCost ?? 0}
                />
              </label> */}
            </div>

            <div className="flex flex-wrap justify-end gap-4 text-sm">
              <span className="text-zinc-500">
                Total dos itens:{" "}
                <strong className="text-fleet-ink">
                  {formatCurrency(
                    maintenanceItems.reduce(
                      (sum, item) => sum + item.quantity * item.unitCost,
                      0,
                    ),
                  )}
                </strong>
              </span>
              <span className="text-zinc-500">
                Mão de obra:{" "}
                <strong className="text-fleet-ink">
                  {formatCurrency(finalizeLaborCost)}
                </strong>
              </span>
              <span className="text-zinc-500">
                Total final:{" "}
                <strong className="text-fleet-ink">
                  {formatCurrency(
                    maintenanceItems.reduce(
                      (sum, item) => sum + item.quantity * item.unitCost,
                      0,
                    ) + finalizeLaborCost,
                  )}
                </strong>
              </span>
            </div>
          </div>

          <label className="space-y-2 text-sm font-medium">
            Anexo da finalização
            <Input
              ref={attachmentInputRef}
              type="file"
              accept="image/*,.pdf,.xml,.txt,.csv,.xlsx,.xls,.doc,.docx"
              onChange={(event) =>
                setAttachmentFile(event.target.files?.[0] ?? undefined)
              }
            />
            {attachmentFile && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-fleet-line bg-zinc-50 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-fleet-ink">
                    {attachmentFile.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {(attachmentFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-fleet-line p-1 text-zinc-500 transition hover:bg-white hover:text-red-600"
                  onClick={() => {
                    setAttachmentFile(undefined);
                    if (attachmentInputRef.current) {
                      attachmentInputRef.current.value = "";
                    }
                  }}
                  aria-label="Remover anexo"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {finalizingOrder?.attachments &&
              finalizingOrder.attachments.length > 0 && (
                <div className="space-y-2 rounded-lg border border-fleet-line bg-white px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Anexos atuais
                  </p>
                  {finalizingOrder.attachments.map((url) => {
                    const fileName = attachmentFileNameFromUrl(url);
                    return (
                      <div
                        key={url}
                        className="flex items-center justify-between gap-3 rounded-md border border-fleet-line px-3 py-2"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left text-sm transition hover:text-fleet-green"
                          onClick={() =>
                            void openAttachmentPreview(finalizingOrder._id, url)
                          }
                        >
                          <span className="block break-all font-medium text-fleet-ink">
                            {fileName}
                          </span>
                          <span className="mt-1 block text-xs text-zinc-500">
                            Previsualizar
                          </span>
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-fleet-line p-1 text-zinc-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          onClick={() =>
                            handleDeleteExistingAttachment(
                              finalizingOrder._id,
                              url,
                            )
                          }
                          disabled={deleteAttachmentMutation.isPending}
                          aria-label="Excluir anexo"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
          </label>

          {finalizeError && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {finalizeError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={closeFinalizeModal}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateOrderMutation.isPending}>
              {updateOrderMutation.isPending
                ? "Finalizando..."
                : "Finalizar OS"}
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
          {
            label: "Previsão de entrega",
            value: formatDate(detailOrder?.expectedDeliveryAt),
          },
          { label: "Descrição", value: detailOrder?.description },
          { label: "Observações", value: detailOrder?.observations },
          {
            label: "Descrição final",
            value: detailOrder?.completionDescription,
          },
          {
            label: "Mão de obra",
            value: detailOrder
              ? formatCurrency(detailOrder.laborCost ?? 0)
              : undefined,
          },
          {
            label: "Grupos",
            value: detailOrder
              ? formatCurrency(detailOrder.partsCost ?? 0)
              : undefined,
          },
        ]}
      >
        <div className="rounded-lg border border-fleet-line p-4">
          <strong className="block text-sm text-fleet-ink">
            Itens e serviços
          </strong>
          <div className="mt-3 space-y-2">
            {(detailOrder?.items?.length ?? 0) === 0 && (
              <p className="text-sm text-zinc-500">
                Nenhum item lançado nesta OS.
              </p>
            )}
            {detailOrder?.items?.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-fleet-line px-3 py-2 text-sm"
              >
                <div>
                  <strong className="block text-fleet-ink">{item.name}</strong>
                  <span className="text-xs text-zinc-500">
                    {item.category === "part" ? "Grupo" : "Serviço"}
                    {item.costCenter ? ` • ${item.costCenter}` : ""}
                    {item.quantity ? ` • ${item.quantity}x` : ""}
                  </span>
                </div>
                <span className="font-medium text-fleet-ink">
                  {formatCurrency(item.totalCost ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-fleet-line p-4">
          <strong className="block text-sm text-fleet-ink">Status</strong>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {detailOrder?.status === "closed" ? (
              <Badge tone="green">
                {labelFor(detailOrder.status, maintenanceStatusLabels)}
              </Badge>
            ) : (
              <SearchableSelect
                value={detailOrder?.status ?? "open"}
                onValueChange={(value) => {
                  if (!detailOrder) {
                    return;
                  }
                  if (value === "closed") {
                    openFinalizeModal(detailOrder);
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
                options={maintenanceProgressStatusOptions}
                searchable={false}
                className="max-w-[240px]"
              />
            )}
            {detailOrder?.status !== "closed" && detailOrder && (
              <Button
                type="button"
                onClick={() => openFinalizeModal(detailOrder)}
              >
                Finalizar OS
              </Button>
            )}
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
                onClick={() => void openAttachmentPreview(detailOrder._id, url)}
              >
                <span className="break-all font-medium text-fleet-ink">
                  {attachmentFileNameFromUrl(url)}
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
        onClose={closeAttachmentPreview}
        onDownload={() =>
          previewAttachment
            ? void downloadMaintenanceOrderAttachment(
                previewAttachment.orderId,
                previewAttachment.fileName,
              )
            : undefined
        }
      />
    </div>
  );
}
