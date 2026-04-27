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
  deleteMaintenanceOrder,
  downloadMaintenanceOrderAttachment,
  downloadResourceExport,
  fetchMaintenanceOrderAttachmentBlob,
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
  { value: "predictive", label: "Preditiva" },
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

const calendarWeekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

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
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date());
  const [previewAttachment, setPreviewAttachment] = useState<{
    objectUrl?: string;
    fileName: string;
    orderId: string;
    url?: string;
  }>();
  const [attachmentFile, setAttachmentFile] = useState<File>();
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const { data: orders = [] } = useQuery({
    queryKey: ["maintenance-orders"],
    queryFn: () => listResource<MaintenanceOrder>("/maintenance/orders"),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles(),
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
    setAttachmentFile(undefined);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
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

  const ordersWithSchedule = useMemo(
    () =>
      filteredOrders.filter((order) => order.scheduledAt).map((order) => ({
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
                      <div className="flex items-center gap-2 text-zinc-500">
                        <Paperclip size={16} className="text-zinc-500" />
                        <span>{order.attachments?.length ?? 0}</span>
                      </div>
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
                        !isSameMonth(day, calendarMonth)
                          ? "opacity-45"
                          : "",
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
                              order.priority === "critical" || order.priority === "high"
                                ? "bg-red-50 text-red-700"
                                : order.priority === "medium"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-emerald-50 text-emerald-700",
                            ].join(" ")}
                          >
                            {vehicles.find((vehicle) => vehicle._id === order.vehicleId)?.plate ??
                              order.vehicleId}
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
                  {selectedDayOrders.length} ordem(ns) planejada(s) para a data selecionada.
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
                          {vehicle?.nickname ?? vehicle?.model ?? "Veículo sem apelido"}
                        </span>
                      </div>
                      <Badge
                        tone={
                          order.priority === "critical" || order.priority === "high"
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
                      <span>{labelFor(order.status, maintenanceStatusLabels)}</span>
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
              {editingOrder?.attachments && editingOrder.attachments.length > 0 && (
                <div className="space-y-2 rounded-lg border border-fleet-line bg-white px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Anexos atuais
                  </p>
                  {editingOrder.attachments.map((url) => {
                    const fileName = attachmentFileNameFromUrl(url);
                    return (
                      <button
                        key={url}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-md border border-fleet-line px-3 py-2 text-left text-sm transition hover:bg-zinc-50"
                        onClick={() => void openAttachmentPreview(editingOrder._id, url)}
                      >
                        <span className="break-all font-medium text-fleet-ink">
                          {fileName}
                        </span>
                        <span className="shrink-0 text-xs text-zinc-500">
                          Previsualizar
                        </span>
                      </button>
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

