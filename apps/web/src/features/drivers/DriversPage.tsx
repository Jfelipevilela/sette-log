import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, CalendarDays, Plus, Search, UserRound } from "lucide-react";
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
import { createDriver, getDrivers, getVehicles } from "../../lib/api";

import { formatDate } from "../../lib/utils";

export function DriversPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [formError, setFormError] = useState<string>();
  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => getDrivers(),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles().catch(() => []),
  });
  const createDriverMutation = useMutation({
    mutationFn: createDriver,
    onSuccess: async () => {
      setIsModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["drivers"] });
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () =>
      setFormError(
        "Não foi possivel criar o motorista. Verifique CNH e vinculo com veiculo.",
      ),
  });

  const filteredDrivers = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) {
      return drivers;
    }
    return drivers.filter(
      (driver) =>
        driver.name.toLowerCase().includes(term) ||
        driver.licenseNumber.toLowerCase().includes(term) ||
        driver.licenseCategory.toLowerCase().includes(term),
    );
  }, [drivers, search]);

  function handleCreateDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    const form = new FormData(event.currentTarget);
    const assignedVehicleId = String(form.get("assignedVehicleId") ?? "");
    createDriverMutation.mutate({
      name: String(form.get("name") ?? ""),
      licenseNumber: String(form.get("licenseNumber") ?? ""),
      licenseCategory: String(form.get("licenseCategory") ?? ""),
      licenseExpiresAt: String(form.get("licenseExpiresAt") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      assignedVehicleId: assignedVehicleId || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Gestão de motoristas</h2>
          <p className="mt-1 text-sm text-zinc-500">
            CNH, associação com veículo, ocorrencias e score de condução.
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Novo motorista
        </Button>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Motoristas cadastrados</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Busca operacional e vencimentos documentais.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search
                className="absolute left-3 top-2.5 text-zinc-400"
                size={18}
              />
              <Input
                className="pl-10"
                placeholder="Buscar por nome, CNH ou categoria"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>Nome</Th>
                    <Th>CNH</Th>
                    <Th>Validade</Th>
                    <Th>Score</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrivers.map((driver) => (
                    <tr key={driver._id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-fleet-green">
                            <UserRound size={17} />
                          </span>
                          <strong>{driver.name}</strong>
                        </div>
                      </Td>
                      <Td>
                        {driver.licenseNumber}
                        <span className="block text-xs text-zinc-500">
                          Categoria {driver.licenseCategory}
                        </span>
                      </Td>
                      <Td>{formatDate(driver.licenseExpiresAt)}</Td>
                      <Td>
                        <strong>{driver.score}</strong>
                      </Td>
                      <Td>
                        <Badge
                          tone={
                            driver.status === "active" ? "green" : "neutral"
                          }
                        >
                          {driver.status}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranking de performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredDrivers
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((driver, index) => (
                <div
                  key={driver._id}
                  className="flex items-center gap-3 rounded-lg border border-fleet-line p-3"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-50 text-fleet-amber">
                    <Award size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate">
                      {index + 1}. {driver.name}
                    </strong>
                    <span className="text-sm text-zinc-500">
                      Score {driver.score}
                    </span>
                  </div>
                </div>
              ))}
            <div className="rounded-lg border border-fleet-line p-4">
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <CalendarDays size={16} className="text-fleet-cyan" />
                Jornada e check-in/check-out preparados para app mobile.
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Modal
        open={isModalOpen}
        title="Novo motorista"
        description="Cadastre CNH, contato e opcionalmente vincule um veiculo principal."
        onClose={() => setIsModalOpen(false)}
      >
        <form className="space-y-4" onSubmit={handleCreateDriver}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Nome
              <Input name="name" placeholder="Nome completo" required />
            </label>
            <label className="space-y-2 text-sm font-medium">
              CNH
              <Input name="licenseNumber" placeholder="SP12345678" required />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Categoria
              <Select name="licenseCategory" defaultValue="B">
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="E">E</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Validade da CNH
              <Input name="licenseExpiresAt" type="date" required />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Veiculo principal
              <Select name="assignedVehicleId" defaultValue="">
                <option value="">Sem vinculo</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle._id} value={vehicle._id}>
                    {vehicle.plate} - {vehicle.model}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Telefone
              <Input name="phone" placeholder="+55 11 90000-0000" />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Email
              <Input
                name="email"
                type="email"
                placeholder="motorista@empresa.com"
              />
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
            <Button type="submit" disabled={createDriverMutation.isPending}>
              {createDriverMutation.isPending
                ? "Salvando..."
                : "Salvar motorista"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
