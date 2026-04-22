import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleDollarSign,
  Download,
  Droplets,
  Edit2,
  Eye,
  Filter,
  Fuel,
  Gauge,
  Paperclip,
  Plus,
  ReceiptText,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { ActionMenu } from "../../components/ui/action-menu";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { AttachmentPreviewModal } from "../../components/ui/attachment-preview-modal";
import { DetailModal } from "../../components/ui/detail-modal";
import { FilterField, FilterPanel } from "../../components/ui/filter-panel";
import { Input } from "../../components/ui/input";
import { LoadingState } from "../../components/ui/loading-state";
import { Modal } from "../../components/ui/modal";
import { Pagination } from "../../components/ui/pagination";
import { SearchableSelect } from "../../components/ui/searchable-select";
import { Table, Td, Th } from "../../components/ui/table";
import {
  apiErrorMessage,
  createFuelRecord,
  deleteFuelRecord,
  downloadResourceExport,
  downloadFuelRecordAttachment,
  fetchFuelRecordAttachmentBlob,
  getDrivers,
  getVehicles,
  listAllResourcePages,
  listResourcePage,
  updateFuelRecord,
  uploadFuelRecordAttachment,
} from "../../lib/api";
import type { FuelRecord } from "../../lib/types";
import { formatCurrency, formatDate, formatDateTime } from "../../lib/utils";

const fuelLabels: Record<string, string> = {
  gasoline: "Gasolina",
  ethanol: "Etanol",
  diesel: "Diesel",
  gnv: "GNV",
  electric: "Eletrico",
};

const fuelOptions = [
  { value: "gasoline", label: "Gasolina" },
  { value: "ethanol", label: "Etanol" },
  { value: "diesel", label: "Diesel" },
  { value: "gnv", label: "GNV" },
  { value: "electric", label: "Eletrico" },
];

function formatKmPerLiter(value?: number) {
  return value
    ? `${Number(value).toLocaleString("pt-BR", {
        maximumFractionDigits: 2,
      })} km/L`
    : "-";
}

export function FuelRecordsPage() {
  const queryClient = useQueryClient();
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FuelRecord>();
  const [detailRecord, setDetailRecord] = useState<FuelRecord>();
  const [formError, setFormError] = useState<string>();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: "",
    vehicleId: "",
    driverId: "",
    fuelType: "",
    from: "",
    to: "",
  });
  const [attachmentFile, setAttachmentFile] = useState<File>();
  const [previewAttachment, setPreviewAttachment] = useState<{
    recordId: string;
    fileName: string;
    originalName: string;
    mimeType?: string;
    url: string;
  }>();

  const { data: recordsPage, isLoading: recordsLoading } = useQuery({
    queryKey: ["fuel-records", page],
    queryFn: () =>
      listResourcePage<FuelRecord>("/finance/fuel-records", {
        page,
        limit: 10,
        sortBy: "filledAt",
        sortDir: "desc",
      }),
  });
  const { data: allFuelRecords = [] } = useQuery({
    queryKey: ["fuel-records-all"],
    queryFn: () =>
      listAllResourcePages<FuelRecord>("/finance/fuel-records", {
        sortBy: "filledAt",
        sortDir: "desc",
      }),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles(),
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => getDrivers(),
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
    onError: (error) =>
      setFormError(
        apiErrorMessage(error, "Não foi possível registrar o abastecimento."),
      ),
  });
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => {
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
    onError: (error) =>
      setFormError(
        apiErrorMessage(error, "Não foi possível editar o abastecimento."),
      ),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteFuelRecord,
    onSuccess: invalidateFuelData,
    onError: (error) =>
      setFormError(
        apiErrorMessage(error, "Não foi possível excluir o abastecimento."),
      ),
  });

  const filteredFuelRecords = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return allFuelRecords.filter((record) => {
      const vehicleText = vehicleLabel(record.vehicleId).toLowerCase();
      const driverText = driverLabel(record.driverId).toLowerCase();
      const filledAt = record.filledAt?.slice(0, 10) ?? "";
      const matchesSearch =
        !term ||
        vehicleText.includes(term) ||
        driverText.includes(term) ||
        String(record.station ?? "")
          .toLowerCase()
          .includes(term);
      return (
        matchesSearch &&
        (!filters.vehicleId || record.vehicleId === filters.vehicleId) &&
        (!filters.driverId || record.driverId === filters.driverId) &&
        (!filters.fuelType || record.fuelType === filters.fuelType) &&
        (!filters.from || filledAt >= filters.from) &&
        (!filters.to || filledAt <= filters.to)
      );
    });
  }, [allFuelRecords, filters, vehicles, drivers]);
  const records = filteredFuelRecords.slice((page - 1) * 10, page * 10);
  const summary = useMemo(() => {
    const source = filteredFuelRecords;
    const liters = source.reduce(
      (total, record) => total + Number(record.liters ?? 0),
      0,
    );
    const totalCost = source.reduce(
      (total, record) => total + Number(record.totalCost ?? 0),
      0,
    );
    const distanceKm = source.reduce(
      (total, record) => total + Number(record.distanceKm ?? 0),
      0,
    );
    const efficiencyLiters = source.reduce(
      (total, record) =>
        record.kmPerLiter ? total + Number(record.liters ?? 0) : total,
      0,
    );
    return {
      count: source.length,
      liters,
      totalCost,
      distanceKm,
      efficiencyLiters,
      averagePrice: liters > 0 ? totalCost / liters : 0,
      averageKmPerLiter:
        efficiencyLiters > 0 ? distanceKm / efficiencyLiters : 0,
    };
  }, [filteredFuelRecords]);

  const fuelKpis = [
    {
      label: "Lançamentos",
      value: summary.count.toLocaleString("pt-BR"),
      detail: "Total cadastrado",
      icon: ReceiptText,
      accent: "from-emerald-500 to-teal-500",
      iconClass: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Litros registrados",
      value: `${summary.liters.toLocaleString("pt-BR")} L`,
      detail: "Volume abastecido",
      icon: Droplets,
      accent: "from-cyan-500 to-sky-500",
      iconClass: "bg-cyan-50 text-cyan-700",
    },
    {
      label: "Custo total",
      value: formatCurrency(summary.totalCost),
      detail: "Valor consolidado",
      icon: CircleDollarSign,
      accent: "from-amber-500 to-orange-500",
      iconClass: "bg-amber-50 text-amber-700",
    },
    {
      label: "Preço médio por litro",
      value: formatCurrency(summary.averagePrice),
      detail: "Total dividido por litros",
      icon: Fuel,
      accent: "from-lime-500 to-emerald-500",
      iconClass: "bg-lime-50 text-lime-700",
    },
    {
      label: "Km/L médio",
      value: formatKmPerLiter(summary.averageKmPerLiter),
      detail: `${summary.distanceKm.toLocaleString("pt-BR")} km analisados`,
      icon: Gauge,
      accent: "from-violet-500 to-fuchsia-500",
      iconClass: "bg-violet-50 text-violet-700",
    },
  ];

  async function invalidateFuelData() {
    await queryClient.invalidateQueries({ queryKey: ["fuel-records"] });
    await queryClient.invalidateQueries({ queryKey: ["fuel-records-all"] });
    await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    await queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
  }

  function vehicleLabel(vehicleId: string) {
    const vehicle = vehicles.find((item) => item._id === vehicleId);
    return vehicle
      ? `${vehicle.plate} - ${vehicle.nickname ?? vehicle.model}`
      : vehicleId;
  }

  function driverLabel(driverId?: string) {
    if (!driverId) {
      return "-";
    }
    return drivers.find((item) => item._id === driverId)?.name ?? driverId;
  }

  const vehicleOptions = vehicles.map((vehicle) => ({
    value: vehicle._id,
    label: `${vehicle.plate} - ${vehicle.nickname ?? vehicle.model}${vehicle.tankCapacityLiters ? ` (${vehicle.tankCapacityLiters} L)` : ""}`,
    searchText: `${vehicle.plate} ${vehicle.nickname ?? ""} ${vehicle.brand} ${vehicle.model}`,
  }));
  const driverOptions = drivers.map((driver) => ({
    value: driver._id,
    label: `${driver.name}${driver.licenseNumber ? ` - CNH ${driver.licenseNumber}` : ""}`,
    searchText: `${driver.name} ${driver.licenseNumber} ${driver.licenseCategory}`,
  }));

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
    const liters = Number(form.get("liters") || 0);
    const totalCost = Number(form.get("totalCost") || 0);
    const pricePerLiter = Number(form.get("pricePerLiter") || 0);
    const driverId = String(form.get("driverId") ?? "");
    const vehicleId = String(form.get("vehicleId") ?? "");
    const odometerRaw = String(form.get("odometerKm") ?? "").trim();
    const odometerKm = odometerRaw ? Number(odometerRaw) : undefined;
    const vehicle = vehicles.find((item) => item._id === vehicleId);
    if (!vehicleId) {
      setFormError("Selecione o ve??culo do abastecimento.");
      return;
    }
    if (
      odometerRaw &&
      (!Number.isFinite(odometerKm) || Number(odometerKm) < 0)
    ) {
      setFormError("Informe um odômetro válido.");
      return;
    }
    if (
      odometerKm !== undefined &&
      vehicle?.odometerKm !== undefined &&
      odometerKm < Number(vehicle.odometerKm)
    ) {
      setFormError(
        `O odômetro informado não pode ser menor que o odômetro atual do veículo (${Number(vehicle.odometerKm).toLocaleString("pt-BR")} km).`,
      );
      return;
    }
    if (vehicle?.tankCapacityLiters && liters > vehicle.tankCapacityLiters) {
      setFormError(
        `Litros informados excedem a capacidade do tanque (${vehicle.tankCapacityLiters} L).`,
      );
      return;
    }
    if (pricePerLiter <= 0) {
      setFormError("Informe o valor pago por litro.");
      return;
    }
    if (Math.abs(liters * pricePerLiter - totalCost) > 0.05) {
      setFormError("Litros x valor por litro não conferem com o valor total.");
      return;
    }
    const payload = {
      vehicleId,
      driverId: driverId || undefined,
      liters,
      totalCost,
      pricePerLiter,
      odometerKm,
      filledAt: String(form.get("filledAt") ?? "") || new Date().toISOString(),
      station: String(form.get("station") ?? ""),
      fuelType: String(form.get("fuelType") ?? "gasoline"),
    };

    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord._id, payload });
      return;
    }
    createMutation.mutate(payload);
  }

  async function openAttachmentPreview(
    recordId: string,
    attachment: NonNullable<FuelRecord["attachments"]>[number],
  ) {
    const blob = await fetchFuelRecordAttachmentBlob(
      recordId,
      attachment.fileName,
    );
    setPreviewAttachment({
      recordId,
      fileName: attachment.fileName,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      url: URL.createObjectURL(blob),
    });
  }

  function closeAttachmentPreview() {
    if (previewAttachment?.url) {
      URL.revokeObjectURL(previewAttachment.url);
    }
    setPreviewAttachment(undefined);
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-lg border border-fleet-line bg-white p-5 shadow-sm md:p-6">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fleet-green via-cyan-500 to-fleet-amber" />
        <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <span className="mb-2 inline-flex rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold uppercase text-emerald-700">
              Controle de combustível
            </span>
            <h2 className="text-2xl font-semibold text-fleet-ink">
              Abastecimentos
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Lançamentos por veículos, litros, custo e odômetro para alimentar
              os indicadores.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => downloadResourceExport("fuel-records")}
            >
              <Download size={18} />
              Exportar CSV
            </Button>
            <Button onClick={openCreateModal}>
              <Plus size={18} />
              Novo abastecimento
            </Button>
          </div>
        </div>
      </section>
      <FilterPanel
        description="Filtre por veículos, motoristas, combustível e período do abastecimento."
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
              placeholder="Buscar placa, motorista ou posto"
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
                    { value: "", label: "Todos os veículos" },
                    ...vehicleOptions,
                  ]}
                />
              </FilterField>
              <FilterField label="Motorista">
                <SearchableSelect
                  value={filters.driverId}
                  onValueChange={(value) =>
                    setFilters((current) => ({ ...current, driverId: value }))
                  }
                  placeholder="Todos os motoristas"
                  searchPlaceholder="Buscar motorista"
                  options={[
                    { value: "", label: "Todos os motoristas" },
                    ...driverOptions,
                  ]}
                />
              </FilterField>
              <FilterField label="Combustível">
                <SearchableSelect
                  value={filters.fuelType}
                  onValueChange={(value) =>
                    setFilters((current) => ({ ...current, fuelType: value }))
                  }
                  placeholder="Todos"
                  searchPlaceholder="Buscar combustível"
                  options={[{ value: "", label: "Todos" }, ...fuelOptions]}
                />
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
                onClick={() => {
                  setPage(1);
                  setFilters({
                    search: "",
                    vehicleId: "",
                    driverId: "",
                    fuelType: "",
                    from: "",
                    to: "",
                  });
                }}
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
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {fuelKpis.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.label}
              className="group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.10)]"
            >
              <span
                className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.accent}`}
              />
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${item.iconClass}`}
                >
                  <Icon size={21} />
                </span>
              </div>
              <span className="mt-5 block text-sm font-medium text-zinc-500">
                {item.label}
              </span>
              <strong className="mt-2 block break-words text-2xl font-semibold tracking-tight text-fleet-ink">
                {item.value}
              </strong>
              <span className="mt-2 block text-xs text-zinc-500">
                {item.detail}
              </span>
            </Card>
          );
        })}
      </section>

      <section className="hidden">
        <Card className="p-5">
          <ReceiptText className="text-fleet-green" />
          <span className="mt-4 block text-sm text-zinc-500">Lançamentos</span>
          <strong className="mt-2 block text-3xl text-fleet-ink">
            {summary.count}
          </strong>
        </Card>
        <Card className="p-5">
          <span className="text-sm text-zinc-500">Litros registrados</span>
          <strong className="mt-2 block text-3xl">
            {summary.liters.toLocaleString("pt-BR")} L
          </strong>
        </Card>
        <Card className="p-5">
          <span className="text-sm text-zinc-500">Custo total</span>
          <strong className="mt-2 block text-3xl">
            {formatCurrency(summary.totalCost)}
          </strong>
        </Card>
        <Card className="p-5">
          <span className="text-sm text-zinc-500">Preço médio por litro</span>
          <strong className="mt-2 block text-3xl">
            {formatCurrency(summary.averagePrice)}
          </strong>
        </Card>
        <Card className="p-5">
          <Gauge className="text-fleet-green" />
          <span className="mt-4 block text-sm text-zinc-500">Km/L médio</span>
          <strong className="mt-2 block text-3xl text-fleet-ink">
            {formatKmPerLiter(summary.averageKmPerLiter)}
          </strong>
          <span className="mt-1 block text-xs text-zinc-500">
            {summary.distanceKm.toLocaleString("pt-BR")} km analisados
          </span>
        </Card>
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-fleet-line bg-zinc-50/70">
          <div>
            <CardTitle>Histórico de abastecimentos</CardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              O km/L usa o odômetro deste lançamento contra o abastecimento
              anterior do mesmo veículo.
            </p>
          </div>
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
                    <Th>Ve­culo</Th>
                    <Th>Motorista</Th>
                    <Th>Combustível</Th>
                    <Th>Litros</Th>
                    <Th>R$/L</Th>
                    <Th>Total</Th>
                    <Th>Km/L</Th>
                    <Th>Anexos</Th>
                    <Th>Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record._id}>
                      <Td>{formatDate(record.filledAt)}</Td>
                      <Td>
                        <strong>{vehicleLabel(record.vehicleId)}</strong>
                        <span className="block text-xs text-zinc-500">
                          {record.station ?? "-"}
                        </span>
                      </Td>
                      <Td>{driverLabel(record.driverId)}</Td>
                      <Td>
                        <Badge tone="cyan">
                          {fuelLabels[record.fuelType] ?? record.fuelType}
                        </Badge>
                      </Td>
                      <Td>
                        {Number(record.liters ?? 0).toLocaleString("pt-BR")} L
                      </Td>
                      <Td>
                        {formatCurrency(Number(record.pricePerLiter ?? 0))}
                      </Td>
                      <Td>{formatCurrency(Number(record.totalCost ?? 0))}</Td>
                      <Td>
                        <Badge tone={record.kmPerLiter ? "green" : "neutral"}>
                          {formatKmPerLiter(record.kmPerLiter)}
                        </Badge>
                      </Td>
                      <Td>
                        <span className="inline-flex items-center gap-1 text-sm text-zinc-600">
                          <Paperclip size={14} />
                          {record.attachments?.length ?? 0}
                        </span>
                      </Td>
                      <Td>
                        <ActionMenu
                          items={[
                            {
                              label: "Editar",
                              icon: <Edit2 size={15} />,
                              onClick: () => openEditModal(record),
                            },
                            {
                              label: "Detalhes",
                              icon: <Eye size={15} />,
                              onClick: () => setDetailRecord(record),
                            },
                            {
                              label: "Excluir",
                              icon: <Trash2 size={15} />,
                              danger: true,
                              disabled: deleteMutation.isPending,
                              onClick: () => {
                                if (
                                  window.confirm("Excluir este abastecimento?")
                                ) {
                                  deleteMutation.mutate(record._id);
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
              <Pagination
                page={page}
                totalPages={Math.max(
                  1,
                  Math.ceil(filteredFuelRecords.length / 10),
                )}
                total={filteredFuelRecords.length}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={isModalOpen}
        title={editingRecord ? "Editar abastecimento" : "Novo abastecimento"}
        description="Informe veículos, combustível, litros, valor e odômetro. O km/L será calculado com o abastecimento anterior do mesmo veículo."
        onClose={closeModal}
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              veículo
              <SearchableSelect
                name="vehicleId"
                required
                defaultValue={editingRecord?.vehicleId ?? ""}
                placeholder="Selecione"
                searchPlaceholder="Buscar placa, modelo ou apelido"
                options={vehicleOptions}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Motorista
              <SearchableSelect
                name="driverId"
                defaultValue={editingRecord?.driverId ?? ""}
                placeholder="Não informado"
                searchPlaceholder="Buscar motorista ou CNH"
                options={[
                  { value: "", label: "Não informado" },
                  ...driverOptions,
                ]}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Combustível
              <SearchableSelect
                name="fuelType"
                defaultValue={editingRecord?.fuelType ?? "gasoline"}
                options={fuelOptions}
                searchPlaceholder="Buscar combustível"
                searchable={false}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Litros
              <Input
                name="liters"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={editingRecord?.liters}
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Valor por litro
              <Input
                name="pricePerLiter"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={
                  editingRecord?.pricePerLiter ??
                  (editingRecord?.liters
                    ? Number(editingRecord.totalCost ?? 0) /
                      editingRecord.liters
                    : undefined)
                }
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Valor total
              <Input
                name="totalCost"
                type="number"
                min="0"
                step="0.01"
                defaultValue={editingRecord?.totalCost}
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Odômetro
              <Input
                name="odometerKm"
                type="number"
                min="0"
                defaultValue={editingRecord?.odometerKm ?? ""}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Data
              <Input
                name="filledAt"
                type="datetime-local"
                defaultValue={editingRecord?.filledAt?.slice(0, 16)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Posto / fornecedor
              <Input
                name="station"
                placeholder="Posto ou fornecedor"
                defaultValue={editingRecord?.station}
              />
            </label>
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Nota fiscal / comprovante
              <Input
                name="attachment"
                type="file"
                accept="image/*,.pdf,.xml,.txt,.csv,.xlsx"
                onChange={(event) => setAttachmentFile(event.target.files?.[0])}
              />
              <span className="block text-xs font-normal text-zinc-500">
                Aceita imagem, PDF, XML, TXT, CSV ou XLSX ate 10 MB.
              </span>
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
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Salvando..."
                : "Salvar abastecimento"}
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
          {
            label: "veículo",
            value: detailRecord
              ? vehicleLabel(detailRecord.vehicleId)
              : undefined,
          },
          {
            label: "Motorista",
            value: detailRecord
              ? driverLabel(detailRecord.driverId)
              : undefined,
          },
          { label: "Posto / fornecedor", value: detailRecord?.station },
          {
            label: "Data e hora",
            value: formatDateTime(detailRecord?.filledAt),
          },
          {
            label: "Combustível",
            value: detailRecord
              ? (fuelLabels[detailRecord.fuelType] ?? detailRecord.fuelType)
              : undefined,
          },
          {
            label: "Litros",
            value: detailRecord
              ? `${Number(detailRecord.liters ?? 0).toLocaleString("pt-BR")} L`
              : undefined,
          },
          {
            label: "Valor total",
            value: detailRecord
              ? formatCurrency(Number(detailRecord.totalCost ?? 0))
              : undefined,
          },
          {
            label: "Preço por litro",
            value: detailRecord
              ? formatCurrency(Number(detailRecord.pricePerLiter ?? 0))
              : undefined,
          },
          {
            label: "Odômetro",
            value: detailRecord
              ? `${Number(detailRecord.odometerKm ?? 0).toLocaleString("pt-BR")} km`
              : undefined,
          },
          {
            label: "Km rodados desde o abastecimento anterior",
            value: detailRecord?.distanceKm
              ? `${Number(detailRecord.distanceKm).toLocaleString("pt-BR")} km`
              : "-",
          },
          {
            label: "Km/L do abastecimento",
            value: formatKmPerLiter(detailRecord?.kmPerLiter),
          },
        ]}
      >
        <div className="rounded-lg border border-fleet-line p-4">
          <strong className="block text-sm text-fleet-ink">Anexos</strong>
          <div className="mt-3 space-y-2">
            {(detailRecord?.attachments?.length ?? 0) === 0 && (
              <p className="text-sm text-zinc-500">
                Nenhum anexo enviado para este abastecimento.
              </p>
            )}
            {detailRecord?.attachments?.map((attachment) => (
              <button
                key={attachment.fileName}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-md border border-fleet-line px-3 py-2 text-left text-sm transition hover:bg-zinc-50"
                onClick={() =>
                  openAttachmentPreview(detailRecord._id, attachment)
                }
              >
                <span className="font-medium text-fleet-ink">
                  {attachment.originalName}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {formatDateTime(attachment.uploadedAt)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </DetailModal>

      <AttachmentPreviewModal
        open={Boolean(previewAttachment)}
        title="Previsualizar anexo"
        fileName={previewAttachment?.originalName ?? ""}
        mimeType={previewAttachment?.mimeType}
        url={previewAttachment?.url}
        onClose={closeAttachmentPreview}
        onDownload={() => {
          if (previewAttachment) {
            downloadFuelRecordAttachment(
              previewAttachment.recordId,
              previewAttachment,
            );
          }
        }}
      />
    </div>
  );
}
