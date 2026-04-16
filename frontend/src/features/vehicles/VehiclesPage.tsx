import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Eye, Filter, Plus, Search, Trash2 } from "lucide-react";
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
import { Input } from "../../components/ui/input";
import { LoadingState } from "../../components/ui/loading-state";
import { Modal } from "../../components/ui/modal";
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
  { value: "available", label: "Disponivel" },
  { value: "in_route", label: "Em rota" },
  { value: "stopped", label: "Parado" },
  { value: "maintenance", label: "Manutencao" },
  { value: "inactive", label: "Inativo" },
  { value: "blocked", label: "Bloqueado" },
];

export function VehiclesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle>();
  const [detailVehicle, setDetailVehicle] = useState<Vehicle>();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    status: "",
  });
  const [formError, setFormError] = useState<string>();
  const [page, setPage] = useState(1);
  const { data: vehiclesPage, isLoading: vehiclesLoading } = useQuery({
    queryKey: ["vehicles", page, appliedFilters.search],
    queryFn: () =>
      getVehiclesPage({
        page,
        limit: 10,
        search: appliedFilters.search,
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
        "Não foi possivel criar o veiculo. Verifique placa e campos obrigatórios.",
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
        apiErrorMessage(error, "Não foi possivel editar o veiculo."),
      ),
  });
  const deleteVehicleMutation = useMutation({
    mutationFn: deleteVehicle,
    onSuccess: invalidateVehicleData,
    onError: (error) =>
      setFormError(
        apiErrorMessage(error, "Não foi possivel excluir o veiculo."),
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
    setIsModalOpen(true);
  }

  function openEditModal(vehicle: Vehicle) {
    setEditingVehicle(vehicle);
    setFormError(undefined);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingVehicle(undefined);
    setFormError(undefined);
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
      const matchesStatus =
        !appliedFilters.status || vehicle.status === appliedFilters.status;
      return matchesSearch && matchesStatus;
    });
  }, [appliedFilters, vehicles]);

  function handleCreateVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    const form = new FormData(event.currentTarget);
    const payload = {
      plate: String(form.get("plate") ?? ""),
      brand: String(form.get("brand") ?? ""),
      model: String(form.get("model") ?? ""),
      nickname: String(form.get("nickname") ?? "") || undefined,
      year: Number(form.get("year") || new Date().getFullYear()),
      type: String(form.get("type") || "car"),
      status: String(form.get("status") || "available"),
      odometerKm: Number(form.get("odometerKm") || 0),
      initialOdometerKm: Number(form.get("initialOdometerKm") || 0),
      tankCapacityLiters:
        Number(form.get("tankCapacityLiters") || 0) || undefined,
      costCenter: String(form.get("costCenter") ?? ""),
      sector: String(form.get("sector") ?? ""),
      city: String(form.get("city") ?? ""),
    };

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
          <h2 className="text-2xl font-semibold">Gestao de veiculos</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Cadastro, status operacional, documentos e indicadores por placa.
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus size={18} />
          Novo veiculo
        </Button>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Filtros avancados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
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
            <Input
              placeholder="Unidade"
              disabled
              title="Filial sera ligada ao cadastro multiunidade"
            />
            <SearchableSelect
              value={status}
              onValueChange={setStatus}
              placeholder="Todos os status"
              searchPlaceholder="Buscar status"
              options={[{ value: "", label: "Todos os status" }, ...vehicleStatusOptions]}
            />
            <Button
              variant="secondary"
              onClick={() => {
                setPage(1);
                setAppliedFilters({ search, status });
              }}
            >
              <Filter size={18} />
              Filtrar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Frota cadastrada</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {vehiclesLoading ? (
            <LoadingState label="Carregando veiculos..." />
          ) : (
            <div className="space-y-4">
              <Table>
                <thead>
                  <tr>
                    <Th>Placa</Th>
                    <Th>Veiculo</Th>
                    <Th>Status</Th>
                    <Th>Odometro</Th>
                    <Th>Custo/km</Th>
                    <Th>Ultima posicao</Th>
                    <Th>Acoes</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((vehicle) => (
                    <tr key={vehicle._id}>
                      <Td>
                        <strong>{vehicle.plate}</strong>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-3">
                          <VehicleTypeIcon type={vehicle.type} />
                          <div>
                            <span className="block font-medium">
                              {vehicle.nickname ??
                                `${vehicle.brand} ${vehicle.model}`}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {vehicle.plate} - {vehicle.year} -{" "}
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
                        {formatCurrency(
                          vehicle.financialSummary?.costPerKm ?? 0,
                        )}
                      </Td>
                      <Td>{vehicle.lastPosition?.address ?? "-"}</Td>
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
                                    `Excluir o veiculo ${vehicle.plate}?`,
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
              Tipo
              <SearchableSelect searchable={false} name="type" defaultValue={editingVehicle?.type ?? "car"} options={vehicleTypeOptions} searchPlaceholder="Buscar tipo" />
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
              Odometro inicial
              <Input
                name="odometerKm"
                type="number"
                min="0"
                defaultValue={editingVehicle?.odometerKm ?? 0}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Odometro base de consumo
              <Input
                name="initialOdometerKm"
                type="number"
                min="0"
                placeholder="Km antes do primeiro abastecimento"
                defaultValue={
                  editingVehicle?.initialOdometerKm ??
                  editingVehicle?.odometerKm ??
                  0
                }
              />
              <span className="block text-xs font-normal text-zinc-500">
                Usado como base para calcular o km/L do primeiro abastecimento.
              </span>
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
                : "Salvar veiculo"}
            </Button>
          </div>
        </form>
      </Modal>

      <DetailModal
        open={Boolean(detailVehicle)}
        entityId={detailVehicle?._id}
        title="Detalhes do veiculo"
        description="Informacoes operacionais, financeiras e auditoria do cadastro."
        onClose={() => setDetailVehicle(undefined)}
        fields={[
          { label: "Placa", value: detailVehicle?.plate },
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
            label: "Odometro",
            value: detailVehicle
              ? `${detailVehicle.odometerKm.toLocaleString("pt-BR")} km`
              : undefined,
          },
          {
            label: "Odometro base de consumo",
            value:
              detailVehicle?.initialOdometerKm !== undefined
                ? `${Number(detailVehicle.initialOdometerKm).toLocaleString("pt-BR")} km`
                : "-",
          },
          {
            label: "Tanque",
            value: detailVehicle?.tankCapacityLiters
              ? `${detailVehicle.tankCapacityLiters.toLocaleString("pt-BR")} L`
              : "-",
          },
          { label: "Centro de custo", value: detailVehicle?.costCenter },
          { label: "Setor", value: detailVehicle?.sector },
          { label: "Cidade", value: detailVehicle?.city },
          {
            label: "Custo de combustivel",
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
            label: "Custo por km",
            value: detailVehicle
              ? formatCurrency(detailVehicle.financialSummary?.costPerKm ?? 0)
              : undefined,
          },
          {
            label: "Ultima posicao",
            value: detailVehicle?.lastPosition?.address,
          },
        ]}
      />
    </div>
  );
}
