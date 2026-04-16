import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Filter, Plus, Search } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Modal } from "../../components/ui/modal";
import { Select } from "../../components/ui/select";
import { Table, Td, Th } from "../../components/ui/table";
import { createVehicle, getVehicles } from "../../lib/api";
import { mockVehicles } from "../../lib/mock-data";
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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    status: "",
  });
  const [formError, setFormError] = useState<string>();
  const { data: vehicles = mockVehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles().catch(() => mockVehicles),
  });
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
        "Não foi possivel criar o veiculo. Verifique placa e campos obrigatorios.",
      ),
  });

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
    createVehicleMutation.mutate({
      plate: String(form.get("plate") ?? ""),
      brand: String(form.get("brand") ?? ""),
      model: String(form.get("model") ?? ""),
      year: Number(form.get("year") || new Date().getFullYear()),
      type: String(form.get("type") || "car"),
      status: "available",
      odometerKm: Number(form.get("odometerKm") || 0),
      costCenter: String(form.get("costCenter") ?? ""),
    });
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
        <Button onClick={() => setIsModalOpen(true)}>
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
              <option value="maintenance">Manutenção</option>
              <option value="inactive">Inativo</option>
              <option value="blocked">Bloqueado</option>
            </Select>
            <Button
              variant="secondary"
              onClick={() => setAppliedFilters({ search, status })}
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
          <Table>
            <thead>
              <tr>
                <Th>Placa</Th>
                <Th>Veiculo</Th>
                <Th>Status</Th>
                <Th>Odometro</Th>
                <Th>Custo/km</Th>
                <Th>Ultima posicao</Th>
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
                      {vehicle.brand} {vehicle.model}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {vehicle.year} - {vehicle.type}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={statusTone[vehicle.status] ?? "neutral"}>
                      {vehicle.status}
                    </Badge>
                  </Td>
                  <Td>{vehicle.odometerKm.toLocaleString("pt-BR")} km</Td>
                  <Td>
                    {formatCurrency(vehicle.financialSummary?.costPerKm ?? 0)}
                  </Td>
                  <Td>{vehicle.lastPosition?.address ?? "-"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Modal
        open={isModalOpen}
        title="Novo veiculo"
        description="Cadastre um automovel, utilitario ou caminhao na frota operacional."
        onClose={() => setIsModalOpen(false)}
      >
        <form className="space-y-4" onSubmit={handleCreateVehicle}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Placa
              <Input name="plate" placeholder="ABC1D23" required />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Tipo
              <Select name="type" defaultValue="car">
                <option value="car">Automovel</option>
                <option value="van">Van</option>
                <option value="truck">Caminhao</option>
                <option value="bus">Onibus</option>
                <option value="motorcycle">Moto</option>
                <option value="equipment">Equipamento</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Marca
              <Input name="brand" placeholder="Toyota" required />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Modelo
              <Input name="model" placeholder="Corolla" required />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Ano
              <Input
                name="year"
                type="number"
                min="1950"
                defaultValue={new Date().getFullYear()}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Odometro inicial
              <Input name="odometerKm" type="number" min="0" defaultValue="0" />
            </label>
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Centro de custo
              <Input name="costCenter" placeholder="Operação urbana" />
            </label>
          </div>
          {formError && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createVehicleMutation.isPending}>
              {createVehicleMutation.isPending
                ? "Salvando..."
                : "Salvar veiculo"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
