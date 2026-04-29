import { FormEvent, useMemo, useRef, useState } from "react";
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
  X,
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
  createDriverFuelPortalRecord,
  createFuelRecord,
  deleteFuelRecord,
  downloadResourceExport,
  downloadFuelRecordAttachment,
  fetchDriverFuelPortalAttachmentBlob,
  fetchFuelRecordAttachmentBlob,
  getDriverFuelPortalContext,
  getDriverFuelPortalRecords,
  getDrivers,
  getVehicles,
  listAllResourcePages,
  listResourcePage,
  updateFuelRecord,
  uploadDriverFuelPortalAttachment,
  uploadFuelRecordAttachment,
} from "../../lib/api";
import type { FuelRecord } from "../../lib/types";
import { formatCurrency, formatDate, formatDateTime } from "../../lib/utils";
import { hasPermission, PERMISSIONS } from "../../lib/permissions";
import { useAuthStore } from "../../store/auth-store";

const fuelLabels: Record<string, string> = {
  gasoline: "Gasolina",
  ethanol: "Etanol",
  diesel: "Diesel",
  diesel_s10: "Diesel S-10",
  gnv: "GNV",
  electric: "Eletrico",
};

const fuelOptions = [
  { value: "gasoline", label: "Gasolina" },
  { value: "ethanol", label: "Etanol" },
  { value: "diesel", label: "Diesel" },
  { value: "diesel_s10", label: "Diesel S-10" },
  { value: "gnv", label: "GNV" },
  { value: "electric", label: "Eletrico" },
];

const driverAttachmentDefinitions = [
  {
    category: "dashboard_before",
    label: "Painel antes do abastecimento",
    requiredInDriverFlow: true,
  },
  {
    category: "dashboard_after",
    label: "Painel depois do abastecimento",
    requiredInDriverFlow: true,
  },
  { category: "invoice", label: "Nota fiscal", requiredInDriverFlow: true },
  {
    category: "pump",
    label: "Bomba com valor e litros",
    requiredInDriverFlow: true,
  },
  {
    category: "vehicle_front",
    label: "Frente do carro com placa",
    requiredInDriverFlow: true,
  },
  {
    category: "receipt",
    label: "Comprovante adicional",
    requiredInDriverFlow: false,
  },
] as const;

const attachmentCategoryLabels = Object.fromEntries(
  driverAttachmentDefinitions.map((item) => [item.category, item.label]),
);

function formatKmPerLiter(value?: number) {
  return value
    ? `${Number(value).toLocaleString("pt-BR", {
        maximumFractionDigits: 2,
      })} km/L`
    : "-";
}

export function FuelRecordsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FuelRecord>();
  const [detailRecord, setDetailRecord] = useState<FuelRecord>();
  const [formError, setFormError] = useState<string>();
  const [driverFlowEnabled, setDriverFlowEnabled] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: "",
    vehicleId: "",
    driverId: "",
    fuelType: "",
    from: "",
    to: "",
  });
  const [attachmentFiles, setAttachmentFiles] = useState<
    Record<string, File | undefined>
  >({});
  const [attachmentInputVersion, setAttachmentInputVersion] = useState(0);
  const [litersValue, setLitersValue] = useState("");
  const [pricePerLiterValue, setPricePerLiterValue] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedFuelType, setSelectedFuelType] = useState("gasoline");
  const [previewAttachment, setPreviewAttachment] = useState<{
    recordId: string;
    fileName: string;
    originalName: string;
    mimeType?: string;
    url: string;
  }>();

  const isTechnicianPortal =
    hasPermission(user, PERMISSIONS.FUEL_DRIVER_PORTAL_ACCESS) &&
    !hasPermission(user, PERMISSIONS.FINANCE_VIEW);

  const { isLoading: recordsLoading } = useQuery({
    queryKey: ["fuel-records", page],
    queryFn: () =>
      listResourcePage<FuelRecord>("/finance/fuel-records", {
        page,
        limit: 10,
        sortBy: "filledAt",
        sortDir: "desc",
      }),
    enabled: !isTechnicianPortal,
  });
  const { data: allFuelRecords = [] } = useQuery({
    queryKey: ["fuel-records-all"],
    queryFn: () =>
      listAllResourcePages<FuelRecord>("/finance/fuel-records", {
        sortBy: "filledAt",
        sortDir: "desc",
      }),
    enabled: !isTechnicianPortal,
  });
  const { data: driverPortalRecords = [] } = useQuery({
    queryKey: ["driver-fuel-portal-records"],
    queryFn: getDriverFuelPortalRecords,
    enabled: isTechnicianPortal,
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles(),
    enabled: !isTechnicianPortal,
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => getDrivers(),
    enabled: !isTechnicianPortal,
  });

  const { data: driverPortalContext, isLoading: driverPortalContextLoading } = useQuery({
    queryKey: ["driver-fuel-portal-context"],
    queryFn: getDriverFuelPortalContext,
    enabled: isTechnicianPortal,
  });
  const driverPortalLoading = isTechnicianPortal && driverPortalContextLoading;
  const linkedDriver = driverPortalContext?.driver;
  const linkedVehicle = driverPortalContext?.vehicle;
  const selectedVehicle = isTechnicianPortal
    ? linkedVehicle
    : vehicles.find((item) => item._id === selectedVehicleId);
  const acceptedFuelOptions = useMemo(() => {
    const acceptedFuelTypes = selectedVehicle?.acceptedFuelTypes?.length
      ? selectedVehicle.acceptedFuelTypes
      : fuelOptions.map((option) => option.value);
    return fuelOptions.filter((option) =>
      acceptedFuelTypes.includes(option.value),
    );
  }, [selectedVehicle]);

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const created = isTechnicianPortal
        ? await createDriverFuelPortalRecord(payload)
        : await createFuelRecord(payload);
      await Promise.all(
        Object.entries(attachmentFiles)
          .filter(([, file]) => Boolean(file))
          .map(([category, file]) =>
            isTechnicianPortal
              ? uploadDriverFuelPortalAttachment(
                  created._id,
                  file as File,
                  category,
                )
              : uploadFuelRecordAttachment(created._id, file as File, category),
          ),
      );
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
      await Promise.all(
        Object.entries(attachmentFiles)
          .filter(([, file]) => Boolean(file))
          .map(([category, file]) =>
            uploadFuelRecordAttachment(id, file as File, category),
          ),
      );
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
    const source = isTechnicianPortal ? driverPortalRecords : allFuelRecords;

    return source.filter((record) => {
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
  }, [allFuelRecords, driverPortalRecords, filters, vehicles, drivers, isTechnicianPortal]);
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
    await queryClient.invalidateQueries({ queryKey: ["driver-fuel-portal-records"] });
    await queryClient.invalidateQueries({ queryKey: ["driver-fuel-portal-context"] });
    await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    await queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
  }

  function vehicleLabel(vehicleId: string) {
    if (linkedVehicle?._id === vehicleId) {
      return `${linkedVehicle.plate} - ${linkedVehicle.nickname ?? linkedVehicle.model}`;
    }
    const vehicle = vehicles.find((item) => item._id === vehicleId);
    return vehicle
      ? `${vehicle.plate} - ${vehicle.nickname ?? vehicle.model}`
      : vehicleId;
  }

  function driverLabel(driverId?: string) {
    if (!driverId) {
      return "-";
    }
    if (linkedDriver?._id === driverId) {
      return linkedDriver.name;
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

  function defaultFuelTypeForVehicle(vehicleId?: string) {
    const vehicle =
      (isTechnicianPortal ? linkedVehicle : vehicles.find((item) => item._id === vehicleId)) ??
      undefined;
    const acceptedFuelTypes = vehicle?.acceptedFuelTypes?.length
      ? vehicle.acceptedFuelTypes
      : fuelOptions.map((option) => option.value);
    return acceptedFuelTypes.find((fuelType) =>
      fuelOptions.some((option) => option.value === fuelType),
    ) ?? "gasoline";
  }

  function handleVehicleChange(nextVehicleId: string) {
    setSelectedVehicleId(nextVehicleId);
    const nextAcceptedFuelOptions = fuelOptions.filter((option) => {
      const vehicle = vehicles.find((item) => item._id === nextVehicleId);
      const acceptedFuelTypes = vehicle?.acceptedFuelTypes?.length
        ? vehicle.acceptedFuelTypes
        : fuelOptions.map((fuelOption) => fuelOption.value);
      return acceptedFuelTypes.includes(option.value);
    });
    if (!nextAcceptedFuelOptions.some((option) => option.value === selectedFuelType)) {
      setSelectedFuelType(nextAcceptedFuelOptions[0]?.value ?? "gasoline");
    }
  }

  function openCreateModal() {
    setEditingRecord(undefined);
    setFormError(undefined);
    setDriverFlowEnabled(isTechnicianPortal);
    setAttachmentFiles({});
    setAttachmentInputVersion((current) => current + 1);
    setLitersValue("");
    setPricePerLiterValue("");
    const nextVehicleId = isTechnicianPortal ? linkedVehicle?._id ?? "" : "";
    setSelectedVehicleId(nextVehicleId);
    setSelectedFuelType(defaultFuelTypeForVehicle(nextVehicleId));
    setIsModalOpen(true);
  }

  function openEditModal(record: FuelRecord) {
    setEditingRecord(record);
    setFormError(undefined);
    setDriverFlowEnabled(
      driverAttachmentDefinitions
        .filter((item) => item.requiredInDriverFlow)
        .every((item) =>
          (record.attachments ?? []).some(
            (attachment) => attachment.category === item.category,
          ),
        ),
    );
    setAttachmentFiles({});
    setAttachmentInputVersion((current) => current + 1);
    setLitersValue(String(record.liters ?? ""));
    setPricePerLiterValue(
      String(
        record.pricePerLiter ??
          (record.liters ? Number(record.totalCost ?? 0) / record.liters : ""),
      ),
    );
    setSelectedVehicleId(record.vehicleId);
    setSelectedFuelType(record.fuelType ?? defaultFuelTypeForVehicle(record.vehicleId));
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingRecord(undefined);
    setFormError(undefined);
    setDriverFlowEnabled(isTechnicianPortal);
    setAttachmentFiles({});
    setAttachmentInputVersion((current) => current + 1);
    setLitersValue("");
    setPricePerLiterValue("");
    setSelectedVehicleId("");
    setSelectedFuelType("gasoline");
    setIsModalOpen(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    const form = new FormData(event.currentTarget);
    const liters = Number(form.get("liters") || 0);
    const pricePerLiter = Number(form.get("pricePerLiter") || 0);
    const totalCost = liters * pricePerLiter;
    const driverId = isTechnicianPortal
      ? String(linkedDriver?._id ?? "")
      : String(form.get("driverId") ?? "");
    const vehicleId = isTechnicianPortal
      ? String(linkedVehicle?._id ?? "")
      : selectedVehicleId;
    const odometerRaw = String(form.get("odometerKm") ?? "").trim();
    const odometerKm = odometerRaw ? Number(odometerRaw) : undefined;
    const vehicle = vehicles.find((item) => item._id === vehicleId);
    if (isTechnicianPortal && !linkedDriver) {
      setFormError(
        "Este usuário técnico não está vinculado a um motorista.",
      );
      return;
    }
    if (isTechnicianPortal && !linkedVehicle) {
      setFormError(
        "O motorista vinculado não possui veículo associado.",
      );
      return;
    }
    if (!vehicleId) {
      setFormError("Selecione o ve??culo do abastecimento.");
      return;
    }
    if (!odometerRaw) {
      setFormError("Informe o odômetro do abastecimento.");
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
      !editingRecord &&
      odometerKm <= Number(vehicle.odometerKm)
    ) {
      setFormError(
        `O odômetro informado deve ser maior que o odômetro atual do veículo (${Number(vehicle.odometerKm).toLocaleString("pt-BR")} km).`,
      );
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
    const payload = {
      vehicleId,
      driverId: driverId || undefined,
      liters,
      totalCost,
      pricePerLiter,
      odometerKm,
      filledAt: String(form.get("filledAt") ?? "") || new Date().toISOString(),
      station: String(form.get("station") ?? ""),
      fuelType: selectedFuelType,
    };

    if (driverFlowEnabled) {
      const missingCategory = driverAttachmentDefinitions
        .filter((item) => item.requiredInDriverFlow)
        .find((item) => {
          const existingAttachment = editingRecord?.attachments?.some(
            (attachment) => attachment.category === item.category,
          );
          return !attachmentFiles[item.category] && !existingAttachment;
        });
      if (missingCategory) {
        setFormError(
          `Envie o anexo obrigatório: ${missingCategory.label.toLowerCase()}.`,
        );
        return;
      }
    } else if (
      !attachmentFiles.receipt &&
      !(editingRecord?.attachments?.some(
        (attachment) => attachment.category === "receipt",
      ) ?? false)
    ) {
      setFormError("Envie ao menos um comprovante do abastecimento.");
      return;
    }

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
    const blob = isTechnicianPortal
      ? await fetchDriverFuelPortalAttachmentBlob(recordId, attachment.fileName)
      : await fetchFuelRecordAttachmentBlob(recordId, attachment.fileName);
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
      {isTechnicianPortal ? (
        <>
          <section className="relative overflow-hidden rounded-lg border border-fleet-line bg-white p-5 shadow-sm md:p-6">
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 via-fleet-green to-fleet-amber" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <span className="mb-2 inline-flex rounded-md bg-cyan-50 px-2.5 py-1 text-xs font-semibold uppercase text-cyan-700">
                  Portal do técnico
                </span>
                <h2 className="text-2xl font-semibold text-fleet-ink">
                  Abastecimento do veículo associado
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                  Preencha o abastecimento com evidências obrigatórias e acompanhe apenas os seus lançamentos.
                </p>
              </div>
              <Button
                onClick={openCreateModal}
                disabled={!linkedDriver || !linkedVehicle}
              >
                <Plus size={18} />
                Realizar abastecimento
              </Button>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-fleet-line bg-zinc-50/70">
                <CardTitle>Motorista vinculado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-5">
                {linkedDriver ? (
                  <>
                    <strong className="block text-lg text-fleet-ink">
                      {linkedDriver.name}
                    </strong>
                    <p className="text-sm text-zinc-500">
                      CNH {linkedDriver.licenseNumber} • Categoria {linkedDriver.licenseCategory}
                    </p>
                    <p className="text-sm text-zinc-500">
                      Status: {linkedDriver.status}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-red-600">
                    Nenhum motorista correspondente foi encontrado para este usuário.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-fleet-line bg-zinc-50/70">
                <CardTitle>Veículo associado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-5">
                {linkedVehicle ? (
                  <>
                    <strong className="block text-lg text-fleet-ink">
                      {linkedVehicle.plate} - {linkedVehicle.nickname ?? linkedVehicle.model}
                    </strong>
                    <p className="text-sm text-zinc-500">
                      {linkedVehicle.brand} {linkedVehicle.model}
                    </p>
                    <p className="text-sm text-zinc-500">
                      Odômetro atual: {Number(linkedVehicle.odometerKm ?? 0).toLocaleString("pt-BR")} km
                    </p>
                    <p className="text-sm text-zinc-500">
                      Tanque: {linkedVehicle.tankCapacityLiters ? `${linkedVehicle.tankCapacityLiters} L` : "Não informado"}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-red-600">
                    O motorista vinculado ainda não possui veículo associado.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      ) : (
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
      )}
      {!isTechnicianPortal && (
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
      )}
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
            <CardTitle>
              {isTechnicianPortal
                ? "Meus abastecimentos"
                : "Histórico de abastecimentos"}
            </CardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              {isTechnicianPortal
                ? "Lista dos abastecimentos enviados por este motorista no veículo associado."
                : "O km/L usa o odômetro deste lançamento contra o abastecimento anterior do mesmo veículo."}
            </p>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {recordsLoading || driverPortalLoading ? (
            <LoadingState label="Carregando abastecimentos..." />
          ) : (
            <div className="space-y-4">
              <Table>
                <thead>
                  <tr>
                    <Th>Data</Th>
                    <Th>Ve­ículo</Th>
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
                              label: "Detalhes",
                              icon: <Eye size={15} />,
                              onClick: () => setDetailRecord(record),
                            },
                            ...(isTechnicianPortal
                              ? []
                              : [
                                  {
                                    label: "Editar",
                                    icon: <Edit2 size={15} />,
                                    onClick: () => openEditModal(record),
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
                                ]),
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
          {isTechnicianPortal && linkedDriver && linkedVehicle && (
            <div className="grid gap-4 rounded-lg border border-cyan-100 bg-cyan-50/70 p-4 md:grid-cols-2">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wide text-cyan-700">
                  Motorista
                </span>
                <strong className="mt-1 block text-sm text-fleet-ink">
                  {linkedDriver.name}
                </strong>
                <span className="block text-xs text-zinc-500">
                  CNH {linkedDriver.licenseNumber}
                </span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wide text-cyan-700">
                  Veículo
                </span>
                <strong className="mt-1 block text-sm text-fleet-ink">
                  {linkedVehicle.plate} - {linkedVehicle.nickname ?? linkedVehicle.model}
                </strong>
                <span className="block text-xs text-zinc-500">
                  Odômetro atual {Number(linkedVehicle.odometerKm ?? 0).toLocaleString("pt-BR")} km
                </span>
                <span className="block text-xs text-zinc-500">
                  Combustíveis aceitos:{" "}
                  {(linkedVehicle.acceptedFuelTypes?.length
                    ? linkedVehicle.acceptedFuelTypes
                    : fuelOptions.map((option) => option.value)
                  )
                    .map((fuelType) => fuelLabels[fuelType] ?? fuelType)
                    .join(", ")}
                </span>
              </div>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {isTechnicianPortal ? (
              <>
                <input
                  type="hidden"
                  name="vehicleId"
                  value={linkedVehicle?._id ?? ""}
                />
                <input
                  type="hidden"
                  name="driverId"
                  value={linkedDriver?._id ?? ""}
                />
              </>
            ) : (
              <>
                <label className="space-y-2 text-sm font-medium md:col-span-2">
                  Veículo
                  <SearchableSelect
                    name="vehicleId"
                    required
                    value={selectedVehicleId}
                    onValueChange={handleVehicleChange}
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
              </>
            )}
            <label className="space-y-2 text-sm font-medium">
              Combustível
              <SearchableSelect
                name="fuelType"
                value={selectedFuelType}
                onValueChange={setSelectedFuelType}
                options={acceptedFuelOptions}
                searchPlaceholder="Buscar combustível"
                searchable={false}
              />
            </label>
            {selectedVehicle && (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-800 md:col-span-2">
                Este veículo aceita:{" "}
                {acceptedFuelOptions
                  .map((option) => option.label)
                  .join(", ")}
                .
              </div>
            )}
            <label className="space-y-2 text-sm font-medium">
              Litros
              <Input
                name="liters"
                type="number"
                min="0.01"
                step="0.01"
                value={litersValue}
                onChange={(event) => setLitersValue(event.target.value)}
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
                value={pricePerLiterValue}
                onChange={(event) => setPricePerLiterValue(event.target.value)}
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
                value={String(
                  (
                    Number(litersValue || 0) * Number(pricePerLiterValue || 0)
                  ).toFixed(2),
                )}
                readOnly
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Odômetro
              <Input
                name="odometerKm"
                type="number"
                min="0"
                required
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
            {!isTechnicianPortal && (
              <label className="space-y-2 text-sm font-medium md:col-span-2">
                <span className="flex items-center justify-between gap-3">
                  <span>Fluxo do motorista</span>
                  <input
                    type="checkbox"
                    checked={driverFlowEnabled}
                    onChange={(event) =>
                      setDriverFlowEnabled(event.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300 text-fleet-green focus:ring-fleet-green"
                  />
                </span>
                <span className="block text-xs font-normal text-zinc-500">
                  Quando ativo, exige todas as evidências do abastecimento do motorista.
                </span>
              </label>
            )}
            <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
              {driverAttachmentDefinitions
                .filter((item) =>
                  driverFlowEnabled ? true : item.category === "receipt",
                )
                .map((item) => {
                  const file = attachmentFiles[item.category];
                  const existingAttachment = editingRecord?.attachments?.find(
                    (attachment) => attachment.category === item.category,
                  );

                  return (
                    <label
                      key={`${item.category}-${attachmentInputVersion}`}
                      className="space-y-2 rounded-lg border border-fleet-line bg-zinc-50/60 p-3 text-sm font-medium"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span>{item.label}</span>
                        {item.requiredInDriverFlow && driverFlowEnabled ? (
                          <Badge tone="amber">Obrigatório</Badge>
                        ) : (
                          <Badge tone="neutral">Opcional</Badge>
                        )}
                      </span>
                      <Input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(event) =>
                          setAttachmentFiles((current) => ({
                            ...current,
                            [item.category]: event.target.files?.[0],
                          }))
                        }
                      />
                      <span className="block text-xs font-normal text-zinc-500">
                        Aceita imagem ou PDF até 10 MB.
                      </span>
                      {file && (
                        <div className="flex items-center justify-between gap-3 rounded-md border border-fleet-line bg-white px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <span className="block truncate font-medium text-fleet-ink">
                              {file.name}
                            </span>
                            <span className="block text-xs text-zinc-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>
                          <button
                            type="button"
                            className="shrink-0 rounded-full p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                            onClick={() =>
                              setAttachmentFiles((current) => ({
                                ...current,
                                [item.category]: undefined,
                              }))
                            }
                            aria-label={`Remover ${item.label}`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                      {!file && existingAttachment && (
                        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                          Já anexado: {existingAttachment.originalName}
                        </div>
                      )}
                    </label>
                  );
                })}
            </div>
          </div>
          {formError && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </p>
          )}
          <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-fleet-line bg-white px-4 py-3 sm:mx-0 sm:flex-row sm:justify-end sm:px-0">
            <Button type="button" variant="secondary" onClick={closeModal} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
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
        description="Informações completas do lançamento e trilha de auditoria."
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
                <div className="min-w-0">
                  <span className="block font-medium text-fleet-ink">
                    {attachment.originalName}
                  </span>
                  <span className="block text-xs text-zinc-500">
                    {attachmentCategoryLabels[attachment.category ?? "receipt"] ??
                      "Comprovante"}
                  </span>
                </div>
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
        onDownload={async () => {
          if (previewAttachment) {
            if (isTechnicianPortal) {
              const blob = await fetchDriverFuelPortalAttachmentBlob(
                previewAttachment.recordId,
                previewAttachment.fileName,
              );
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = previewAttachment.originalName;
              document.body.appendChild(link);
              link.click();
              link.remove();
              window.URL.revokeObjectURL(url);
              return;
            }
            downloadFuelRecordAttachment(previewAttachment.recordId, previewAttachment);
          }
        }}
      />
    </div>
  );
}
