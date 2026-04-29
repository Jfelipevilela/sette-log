import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Edit2, Eye, Filter, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { ActionMenu } from "../../components/ui/action-menu";
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
import { LoadingState } from "../../components/ui/loading-state";
import { Modal } from "../../components/ui/modal";
import { MultiSearchableSelect } from "../../components/ui/multi-searchable-select";
import { Pagination } from "../../components/ui/pagination";
import { SearchableSelect } from "../../components/ui/searchable-select";
import { Table, Td, Th } from "../../components/ui/table";
import {
  VehicleTypeIcon,
  vehicleTypeLabel,
} from "../../components/vehicle-type-icon";
import {
  apiErrorMessage,
  createVehicle,
  deleteVehicle,
  downloadResourceExport,
  getVehiclesPage,
  updateVehicle,
} from "../../lib/api";
import { labelFor, vehicleStatusLabels } from "../../lib/labels";
import type { Vehicle } from "../../lib/types";
import { formatCurrency } from "../../lib/utils";

const statusTone: Record<
  string,
  "green" | "cyan" | "amber" | "red" | "neutral"
> = {
  available: "green",
  in_route: "cyan",
  stopped: "amber",
  maintenance: "red",
  inactive: "neutral",
  blocked: "red",
};

const vehicleTypeOptions = [
  { value: "car", label: "Automovel" },
  { value: "van", label: "Van" },
  { value: "truck", label: "Caminhao" },
  { value: "bus", label: "Onibus" },
  { value: "motorcycle", label: "Moto" },
  { value: "equipment", label: "Equipamento" },
];

const vehicleStatusOptions = [
  { value: "available", label: "Disponível" },
  { value: "in_route", label: "Em rota" },
  { value: "stopped", label: "Parado" },
  { value: "maintenance", label: "Manutenção" },
  { value: "inactive", label: "Inativo" },
  { value: "blocked", label: "Bloqueado" },
];

const fuelTypeOptions = [
  { value: "gasoline", label: "Gasolina" },
  { value: "ethanol", label: "Etanol" },
  { value: "diesel", label: "Diesel comum" },
  { value: "diesel_s10", label: "Diesel S-10" },
  { value: "gnv", label: "GNV" },
  { value: "electric", label: "Elétrico" },
];

const vehicleFuelDefaults: Record<string, string[]> = {
  car: ["gasoline", "ethanol"],
  van: ["diesel_s10"],
  truck: ["diesel_s10"],
  bus: ["diesel_s10"],
  motorcycle: ["gasoline"],
  equipment: ["diesel_s10"],
};

function defaultFuelTypesForVehicleType(type?: string) {
  return vehicleFuelDefaults[type ?? "car"] ?? vehicleFuelDefaults.car ?? [];
}

export function VehiclesPage() {
  const queryClient = useQueryClient();
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle>();
  const [detailVehicle, setDetailVehicle] = useState<Vehicle>();
  const [vehicleTypeValue, setVehicleTypeValue] = useState("car");
  const [acceptedFuelTypesValue, setAcceptedFuelTypesValue] = useState<string[]>(
    defaultFuelTypesForVehicleType("car"),
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [sector, setSector] = useState("");
  const [city, setCity] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    status: "",
    type: "",
    sector: "",
    city: "",
  });
  const [formError, setFormError] = useState<string>();
  const [page, setPage] = useState(1);
  const { data: vehiclesPage, isLoading: vehiclesLoading } = useQuery({
    queryKey: ["vehicles", page, appliedFilters],
    queryFn: () =>
      getVehiclesPage({
        page,
        limit: 10,
        search: appliedFilters.search,
        filters: {
          status: appliedFilters.status || undefined,
          type: appliedFilters.type || undefined,
          sector: appliedFilters.sector || undefined,
          city: appliedFilters.city || undefined,
        },
        sortBy: "updatedAt",
        sortDir: "desc",
      }),
  });
  const vehicles = vehiclesPage?.data ?? [];
  const createVehicleMutation = useMutation({
    mutationFn: createVehicle,
    onSuccess: async () => {
      setIsModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["tracking-live"] });
    },
    onError: () =>
      setFormError(
        "Não foi possível criar o veículo. Verifique placa e campos obrigatórios.",
      ),
  });
  const updateVehicleMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Vehicle> }) =>
      updateVehicle(id, payload),
    onSuccess: async () => {
      closeModal();
      await invalidateVehicleData();
    },
    onError: (error) =>
      setFormError(
        apiErrorMessage(error, "Não foi possível editar o veículo."),
      ),
  });
  const deleteVehicleMutation = useMutation({
    mutationFn: deleteVehicle,
    onSuccess: invalidateVehicleData,
    onError: (error) =>
      setFormError(
        apiErrorMessage(error, "Não foi possível excluir o veículo."),
      ),
  });

  async function invalidateVehicleData() {
    await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    await queryClient.invalidateQueries({ queryKey: ["tracking-live"] });
  }

  function openCreateModal() {
    setEditingVehicle(undefined);
    setFormError(undefined);
    setVehicleTypeValue("car");
    setAcceptedFuelTypesValue(defaultFuelTypesForVehicleType("car"));
    setIsModalOpen(true);
  }

  function openEditModal(vehicle: Vehicle) {
    setEditingVehicle(vehicle);
    setFormError(undefined);
    setVehicleTypeValue(vehicle.type ?? "car");
    setAcceptedFuelTypesValue(
      vehicle.acceptedFuelTypes?.length
        ? vehicle.acceptedFuelTypes
        : defaultFuelTypesForVehicleType(vehicle.type),
    );
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingVehicle(undefined);
    setFormError(undefined);
    setVehicleTypeValue("car");
    setAcceptedFuelTypesValue(defaultFuelTypesForVehicleType("car"));
  }

  function handleVehicleTypeChange(nextType: string) {
    setVehicleTypeValue(nextType);
    if (!editingVehicle) {
      setAcceptedFuelTypesValue(defaultFuelTypesForVehicleType(nextType));
    }
  }

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const term = appliedFilters.search.toLowerCase();
      const matchesSearch =
        !term ||
        vehicle.plate.toLowerCase().includes(term) ||
        vehicle.model.toLowerCase().includes(term) ||
        vehicle.brand.toLowerCase().includes(term) ||
        vehicle.costCenter?.toLowerCase().includes(term) ||
        vehicle.sector?.toLowerCase().includes(term) ||
        vehicle.city?.toLowerCase().includes(term);
      return matchesSearch;
    });
  }, [appliedFilters, vehicles]);

  function handleCreateVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    const form = new FormData(event.currentTarget);
    const initialOdometerRaw = String(form.get("initialOdometerKm") ?? "").trim();
    const payload = {
      plate: String(form.get("plate") ?? ""),
      brand: String(form.get("brand") ?? ""),
      model: String(form.get("model") ?? ""),
      nickname: String(form.get("nickname") ?? "") || undefined,
      vehicleNumber: String(form.get("vehicleNumber") ?? "") || undefined,
      year: Number(form.get("year") || new Date().getFullYear()),
      type: String(form.get("type") || "car"),
      status: String(form.get("status") || "available"),
      odometerKm: Number(form.get("odometerKm") || 0),
      initialOdometerKm: initialOdometerRaw
        ? Number(initialOdometerRaw)
        : undefined,
      tankCapacityLiters:
        Number(form.get("tankCapacityLiters") || 0) || undefined,
      acceptedFuelTypes: acceptedFuelTypesValue,
      costCenter: String(form.get("costCenter") ?? ""),
      sector: String(form.get("sector") ?? ""),
      city: String(form.get("city") ?? ""),
    };

    if (acceptedFuelTypesValue.length === 0) {
      setFormError("Selecione ao menos um combustível aceito para o veículo.");
      return;
    }

    if (editingVehicle) {
      updateVehicleMutation.mutate({ id: editingVehicle._id, payload });
      return;
    }

    createVehicleMutation.mutate(payload);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Gestão de veículos</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Cadastro, status operacional, documentos e indicadores por placa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => downloadResourceExport("vehicles")}
          >
            <Download size={18} />
            Exportar CSV
          </Button>
          <Button onClick={openCreateModal}>
            <Plus size={18} />
            Novo veículo
          </Button>
        </div>
      </section>

      <FilterPanel
        title="Filtros avançados"
        description="Busque a frota por placa, status, tipo, setor e cidade."
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
              placeholder="Buscar por placa, modelo ou centro de custo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        }
        expandedContent={
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FilterField label="Status">
                <SearchableSelect value={status} onValueChange={setStatus} placeholder="Todos os status" searchPlaceholder="Buscar status" options={[{ value: "", label: "Todos os status" }, ...vehicleStatusOptions]} />
              </FilterField>
              <FilterField label="Tipo">
                <SearchableSelect value={type} onValueChange={setType} placeholder="Todos os tipos" searchPlaceholder="Buscar tipo" options={[{ value: "", label: "Todos os tipos" }, ...vehicleTypeOptions]} />
              </FilterField>
              <FilterField label="Setor">
                <Input placeholder="Ex.: Operações" value={sector} onChange={(event) => setSector(event.target.value)} />
              </FilterField>
              <FilterField label="Cidade">
                <Input placeholder="Ex.: São Paulo" value={city} onChange={(event) => setCity(event.target.value)} />
              </FilterField>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => {
                setSearch("");
                setStatus("");
                setType("");
                setSector("");
                setCity("");
                setPage(1);
                setAppliedFilters({ search: "", status: "", type: "", sector: "", city: "" });
              }}>
                <Filter size={18} />
                Limpar filtros
              </Button>
              <Button variant="secondary" onClick={() => {
                setPage(1);
                setAppliedFilters({ search, status, type, sector, city });
              }}>
                <Filter size={18} />
                Aplicar filtros
              </Button>
            </div>
          </div>
        }
      >
        {null}
      </FilterPanel>

      <Card>
        <CardHeader>
          <CardTitle>Frota cadastrada</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {vehiclesLoading ? (
            <LoadingState label="Carregando veículos..." />
          ) : (
            <div className="space-y-4">
              <Table>
                <thead>
                  <tr>
                    <Th>Placa</Th>
                    <Th>Número</Th>
                    <Th>veículo</Th>
                    <Th>Status</Th>
                    <Th>Odômetro</Th>
                    <Th>Km/L médio</Th>
                    {/* <Th>Ultima posição</Th> */}
                    <Th>Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((vehicle) => (
                    <tr key={vehicle._id}>
                      <Td>
                        <strong>{vehicle.plate}</strong>
                      </Td>
                      <Td>{vehicle.vehicleNumber ?? "-"}</Td>
                      <Td>
                        <div className="flex items-center gap-3">
                          <VehicleTypeIcon type={vehicle.type} />
                          <div>
                            <span className="block font-medium">
                              {vehicle.nickname ??
                                `${vehicle.brand} ${vehicle.model}`}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {vehicle.sector} - {vehicle.year} -{" "}
                              {vehicleTypeLabel(vehicle.type)}
                            </span>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <Badge tone={statusTone[vehicle.status] ?? "neutral"}>
                          {labelFor(vehicle.status, vehicleStatusLabels)}
                        </Badge>
                      </Td>
                      <Td>{vehicle.odometerKm.toLocaleString("pt-BR")} km</Td>
                      <Td>
                        {vehicle.financialSummary?.averageKmPerLiter
                          ? `${Number(vehicle.financialSummary.averageKmPerLiter).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} km/L`
                          : "-"}
                      </Td>
                      {/* <Td>{vehicle.lastPosition?.address ?? "-"}</Td> */}
                      <Td>
                        <ActionMenu
                          items={[
                            {
                              label: "Editar",
                              icon: <Edit2 size={15} />,
                              onClick: () => openEditModal(vehicle),
                            },
                            {
                              label: "Detalhes",
                              icon: <Eye size={15} />,
                              onClick: () => setDetailVehicle(vehicle),
                            },
                            {
                              label: "Excluir",
                              icon: <Trash2 size={15} />,
                              danger: true,
                              disabled: deleteVehicleMutation.isPending,
                              onClick: () => {
                                if (
                                  window.confirm(
                                    `Excluir o veículo ${vehicle.plate}?`,
                                  )
                                ) {
                                  deleteVehicleMutation.mutate(vehicle._id);
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
                page={vehiclesPage?.meta.page ?? page}
                totalPages={vehiclesPage?.meta.totalPages ?? 1}
                total={vehiclesPage?.meta.total ?? 0}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={isModalOpen}
        title={editingVehicle ? "Editar veículo" : "Novo veículo"}
        description={
          editingVehicle
            ? "Atualize cadastro, status operacional e dados de custo."
            : "Cadastre um automóvel, utilitário ou caminhão na frota operacional."
        }
        onClose={closeModal}
      >
        <form className="space-y-4" onSubmit={handleCreateVehicle}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Placa
              <Input
                name="plate"
                placeholder="ABC1D23"
                defaultValue={editingVehicle?.plate}
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Número do veículo
              <Input
                name="vehicleNumber"
                placeholder="Ex.: STT-077"
                defaultValue={editingVehicle?.vehicleNumber}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Tipo
              <SearchableSelect
                searchable={false}
                name="type"
                value={vehicleTypeValue}
                onValueChange={handleVehicleTypeChange}
                options={vehicleTypeOptions}
                searchPlaceholder="Buscar tipo"
              />
            </label>
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Combustíveis aceitos
              <MultiSearchableSelect
                value={acceptedFuelTypesValue}
                onValueChange={setAcceptedFuelTypesValue}
                options={fuelTypeOptions}
                placeholder="Selecione os combustíveis aceitos"
                searchPlaceholder="Buscar combustível"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Marca
              <Input
                name="brand"
                placeholder="Toyota"
                defaultValue={editingVehicle?.brand}
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Modelo
              <Input
                name="model"
                placeholder="Corolla"
                defaultValue={editingVehicle?.model}
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Apelido
              <Input
                name="nickname"
                placeholder="Carro do comercial"
                defaultValue={editingVehicle?.nickname}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Ano
              <Input
                name="year"
                type="number"
                min="1950"
                defaultValue={editingVehicle?.year ?? new Date().getFullYear()}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Odômetro inicial
              <Input
                name="odometerKm"
                type="number"
                min="0"
                defaultValue={editingVehicle?.odometerKm ?? 0}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Tanque em litros
              <Input
                name="tankCapacityLiters"
                type="number"
                min="1"
                step="0.1"
                placeholder="55"
                defaultValue={editingVehicle?.tankCapacityLiters}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Status
              <SearchableSelect
                name="status"
                defaultValue={editingVehicle?.status ?? "available"}
                options={vehicleStatusOptions}
                searchPlaceholder="Buscar status"
                searchable={false}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Centro de custo
              <Input
                name="costCenter"
                placeholder="Carros Próprios"
                defaultValue={editingVehicle?.costCenter}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Setor
              <Input
                name="sector"
                placeholder="Logistica"
                defaultValue={editingVehicle?.sector}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Cidade
              <Input
                name="city"
                placeholder="Manaus"
                defaultValue={editingVehicle?.city}
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
                createVehicleMutation.isPending ||
                updateVehicleMutation.isPending
              }
            >
              {createVehicleMutation.isPending ||
              updateVehicleMutation.isPending
                ? "Salvando..."
                : "Salvar veículo"}
            </Button>
          </div>
        </form>
      </Modal>

      <DetailModal
        open={Boolean(detailVehicle)}
        entityId={detailVehicle?._id}
        title="Detalhes do veículos"
        description="Informações operacionais, financeiras e auditoria do cadastro."
        onClose={() => setDetailVehicle(undefined)}
        fields={[
          { label: "Placa", value: detailVehicle?.plate },
          { label: "Número do veículo", value: detailVehicle?.vehicleNumber },
          { label: "Marca", value: detailVehicle?.brand },
          { label: "Modelo", value: detailVehicle?.model },
          { label: "Apelido", value: detailVehicle?.nickname },
          { label: "Ano", value: detailVehicle?.year },
          { label: "Tipo", value: vehicleTypeLabel(detailVehicle?.type) },
          {
            label: "Status",
            value: labelFor(detailVehicle?.status, vehicleStatusLabels),
          },
          {
            label: "Odômetro inicial",
            value:
              detailVehicle?.initialOdometerKm !== undefined
                ? `${Number(detailVehicle.initialOdometerKm).toLocaleString("pt-BR")} km`
                : "-",
          },
          {
            label: "Odômetro atual registrado",
            value: detailVehicle
              ? `${Number(detailVehicle.currentOdometerKm ?? detailVehicle.odometerKm ?? 0).toLocaleString("pt-BR")} km`
              : undefined,
          },
          {
            label: "Tanque",
            value: detailVehicle?.tankCapacityLiters
              ? `${detailVehicle.tankCapacityLiters.toLocaleString("pt-BR")} L`
              : "-",
          },
          {
            label: "Combustíveis aceitos",
            value:
              detailVehicle?.acceptedFuelTypes?.length
                ? detailVehicle.acceptedFuelTypes
                    .map(
                      (fuelType) =>
                        fuelTypeOptions.find((option) => option.value === fuelType)
                          ?.label ?? fuelType,
                    )
                    .join(", ")
                : "-",
          },
          { label: "Centro de custo", value: detailVehicle?.costCenter },
          { label: "Setor", value: detailVehicle?.sector },
          { label: "Cidade", value: detailVehicle?.city },
          {
            label: "Custo de combustí­vel",
            value: detailVehicle
              ? formatCurrency(
                  detailVehicle.financialSummary?.totalFuelCost ?? 0,
                )
              : undefined,
          },
          {
            label: "Litros abastecidos",
            value: detailVehicle
              ? `${Number(detailVehicle.financialSummary?.totalFuelLiters ?? 0).toLocaleString("pt-BR")} L`
              : undefined,
          },
          {
            label: "Despesas",
            value: detailVehicle
              ? formatCurrency(
                  detailVehicle.financialSummary?.totalExpenses ?? 0,
                )
              : undefined,
          },
          {
            label: "Km/L médio",
            value: detailVehicle
              ? detailVehicle.financialSummary?.averageKmPerLiter
                ? `${Number(detailVehicle.financialSummary.averageKmPerLiter).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} km/L`
                : "-"
              : undefined,
          },
          // {
          //   label: "Ultima posição",
          //   value: detailVehicle?.lastPosition?.address,
          // },
        ]}
      />
    </div>
  );
}

