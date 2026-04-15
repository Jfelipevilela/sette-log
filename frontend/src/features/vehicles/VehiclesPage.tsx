import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Eye, Filter, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "../../components/ui/badge";
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
import { Select } from "../../components/ui/select";
import { Table, Td, Th } from "../../components/ui/table";
import {
  apiErrorMessage,
  createVehicle,
  deleteVehicle,
  getVehiclesPage,
  updateVehicle,
} from "../../lib/api";
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
        vehicle.costCenter?.toLowerCase().includes(term);
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
      tankCapacityLiters:
        Number(form.get("tankCapacityLiters") || 0) || undefined,
      costCenter: String(form.get("costCenter") ?? ""),
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
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="available">Disponivel</option>
              <option value="in_route">Em rota</option>
              <option value="stopped">Parado</option>
              <option value="maintenance">Manutencao</option>
              <option value="inactive">Inativo</option>
              <option value="blocked">Bloqueado</option>
            </Select>
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
                        <span className="block font-medium">
                          {vehicle.nickname ??
                            `${vehicle.brand} ${vehicle.model}`}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {vehicle.plate} - {vehicle.year} - {vehicle.type}
                        </span>
                      </Td>
                      <Td>
                        <Badge tone={statusTone[vehicle.status] ?? "neutral"}>
                          {vehicle.status}
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
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => openEditModal(vehicle)}
                          >
                            <Edit2 size={15} />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setDetailVehicle(vehicle)}
                          >
                            <Eye size={15} />
                            Detalhes
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            disabled={deleteVehicleMutation.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Excluir o veiculo ${vehicle.plate}?`,
                                )
                              ) {
                                deleteVehicleMutation.mutate(vehicle._id);
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
              <Select name="type" defaultValue={editingVehicle?.type ?? "car"}>
                <option value="car">Automóvel</option>
                <option value="van">Van</option>
                <option value="truck">Caminhão</option>
                <option value="bus">Ônibus</option>
                <option value="motorcycle">Moto</option>
                <option value="equipment">Equipamento</option>
              </Select>
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
              <Select
                name="status"
                defaultValue={editingVehicle?.status ?? "available"}
              >
                <option value="available">Disponivel</option>
                <option value="in_route">Em rota</option>
                <option value="stopped">Parado</option>
                <option value="maintenance">Manutencao</option>
                <option value="inactive">Inativo</option>
                <option value="blocked">Bloqueado</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Centro de custo
              <Input
                name="costCenter"
                placeholder="Carros Próprios"
                defaultValue={editingVehicle?.costCenter}
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
          { label: "Tipo", value: detailVehicle?.type },
          { label: "Status", value: detailVehicle?.status },
          {
            label: "Odometro",
            value: detailVehicle
              ? `${detailVehicle.odometerKm.toLocaleString("pt-BR")} km`
              : undefined,
          },
          {
            label: "Tanque",
            value: detailVehicle?.tankCapacityLiters
              ? `${detailVehicle.tankCapacityLiters.toLocaleString("pt-BR")} L`
              : "-",
          },
          { label: "Centro de custo", value: detailVehicle?.costCenter },
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
