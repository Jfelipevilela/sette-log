import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  CalendarDays,
  Edit2,
  Eye,
  Plus,
  Search,
  Trash2,
  UserRound,
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
import { Input } from "../../components/ui/input";
import { DetailModal } from "../../components/ui/detail-modal";
import { Modal } from "../../components/ui/modal";
import { SearchableSelect } from "../../components/ui/searchable-select";
import { Table, Td, Th } from "../../components/ui/table";
import {
  apiErrorMessage,
  createDriver,
  deleteDriver,
  getDrivers,
  getVehicles,
  updateDriver,
} from "../../lib/api";
import { labelFor } from "../../lib/labels";
import type { Driver } from "../../lib/types";

import { formatDate } from "../../lib/utils";

const licenseCategoryOptions = ["A", "B", "C", "D", "E"].map((category) => ({
  value: category,
  label: category,
}));

const driverStatusOptions = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
  { value: "blocked", label: "Bloqueado" },
  { value: "vacation", label: "Ferias" },
];

export function DriversPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver>();
  const [detailDriver, setDetailDriver] = useState<Driver>();
  const [search, setSearch] = useState("");
  const [formError, setFormError] = useState<string>();
  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => getDrivers(),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles(),
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
  const updateDriverMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Driver> }) =>
      updateDriver(id, payload),
    onSuccess: async () => {
      closeModal();
      await invalidateDriverData();
    },
    onError: (error) =>
      setFormError(
        apiErrorMessage(error, "Não foi possivel editar o motorista."),
      ),
  });
  const deleteDriverMutation = useMutation({
    mutationFn: deleteDriver,
    onSuccess: invalidateDriverData,
    onError: (error) =>
      setFormError(
        apiErrorMessage(error, "Não foi possivel excluir o motorista."),
      ),
  });

  async function invalidateDriverData() {
    await queryClient.invalidateQueries({ queryKey: ["drivers"] });
    await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  function openCreateModal() {
    setEditingDriver(undefined);
    setFormError(undefined);
    setIsModalOpen(true);
  }

  function openEditModal(driver: Driver) {
    setEditingDriver(driver);
    setFormError(undefined);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingDriver(undefined);
    setFormError(undefined);
  }

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

  const vehicleOptions = vehicles.map((vehicle) => ({
    value: vehicle._id,
    label: `${vehicle.plate} - ${vehicle.nickname ?? vehicle.model}`,
    searchText: `${vehicle.plate} ${vehicle.nickname ?? ""} ${vehicle.brand} ${vehicle.model}`,
  }));

  function handleCreateDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    const form = new FormData(event.currentTarget);
    const assignedVehicleId = String(form.get("assignedVehicleId") ?? "");
    const payload = {
      name: String(form.get("name") ?? ""),
      licenseNumber: String(form.get("licenseNumber") ?? ""),
      licenseCategory: String(form.get("licenseCategory") ?? ""),
      licenseExpiresAt: String(form.get("licenseExpiresAt") ?? ""),
      status: String(form.get("status") || "active"),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      assignedVehicleId: assignedVehicleId || undefined,
    };

    if (editingDriver) {
      updateDriverMutation.mutate({ id: editingDriver._id, payload });
      return;
    }

    createDriverMutation.mutate(payload);
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
        <Button onClick={openCreateModal}>
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
                    <Th>Acoes</Th>
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
                          {labelFor(driver.status)}
                        </Badge>
                      </Td>
                      <Td>
                        <ActionMenu
                          items={[
                            {
                              label: "Editar",
                              icon: <Edit2 size={15} />,
                              onClick: () => openEditModal(driver),
                            },
                            {
                              label: "Detalhes",
                              icon: <Eye size={15} />,
                              onClick: () => setDetailDriver(driver),
                            },
                            {
                              label: "Excluir",
                              icon: <Trash2 size={15} />,
                              danger: true,
                              disabled: deleteDriverMutation.isPending,
                              onClick: () => {
                                if (
                                  window.confirm(
                                    `Excluir o motorista ${driver.name}?`,
                                  )
                                ) {
                                  deleteDriverMutation.mutate(driver._id);
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
        title={editingDriver ? "Editar motorista" : "Novo motorista"}
        description="Cadastre CNH, contato e opcionalmente vincule um veiculo principal."
        onClose={closeModal}
      >
        <form className="space-y-4" onSubmit={handleCreateDriver}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Nome
              <Input
                name="name"
                placeholder="Nome completo"
                defaultValue={editingDriver?.name}
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              CNH
              <Input
                name="licenseNumber"
                placeholder="SP12345678"
                defaultValue={editingDriver?.licenseNumber}
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Categoria
              <SearchableSelect
                name="licenseCategory"
                defaultValue={editingDriver?.licenseCategory ?? "B"}
                options={licenseCategoryOptions}
                searchPlaceholder="Buscar categoria"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Validade da CNH
              <Input
                name="licenseExpiresAt"
                type="date"
                defaultValue={editingDriver?.licenseExpiresAt?.slice(0, 10)}
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Veiculo principal
              <SearchableSelect
                name="assignedVehicleId"
                defaultValue={editingDriver?.assignedVehicleId ?? ""}
                placeholder="Sem vinculo"
                searchPlaceholder="Buscar placa, modelo ou apelido"
                options={[
                  { value: "", label: "Sem vinculo" },
                  ...vehicleOptions,
                ]}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Telefone
              <Input
                name="phone"
                placeholder="+55 11 90000-0000"
                defaultValue={editingDriver?.phone}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Email
              <Input
                name="email"
                type="email"
                placeholder="motorista@empresa.com"
                defaultValue={editingDriver?.email}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Status
              <SearchableSelect
                name="status"
                defaultValue={editingDriver?.status ?? "active"}
                options={driverStatusOptions}
                searchPlaceholder="Buscar status"
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
                createDriverMutation.isPending || updateDriverMutation.isPending
              }
            >
              {createDriverMutation.isPending || updateDriverMutation.isPending
                ? "Salvando..."
                : "Salvar motorista"}
            </Button>
          </div>
        </form>
      </Modal>

      <DetailModal
        open={Boolean(detailDriver)}
        entityId={detailDriver?._id}
        title="Detalhes do motorista"
        description="Dados cadastrais, CNH, performance e trilha de auditoria."
        onClose={() => setDetailDriver(undefined)}
        fields={[
          { label: "Nome", value: detailDriver?.name },
          { label: "CNH", value: detailDriver?.licenseNumber },
          { label: "Categoria", value: detailDriver?.licenseCategory },
          {
            label: "Validade da CNH",
            value: formatDate(detailDriver?.licenseExpiresAt),
          },
          { label: "Telefone", value: detailDriver?.phone },
          { label: "Email", value: detailDriver?.email },
          { label: "Status", value: labelFor(detailDriver?.status) },
          { label: "Score", value: detailDriver?.score },
          {
            label: "Veiculo vinculado",
            value: detailDriver?.assignedVehicleId
              ? (vehicles.find(
                  (vehicle) => vehicle._id === detailDriver.assignedVehicleId,
                )?.plate ?? detailDriver.assignedVehicleId)
              : "-",
          },
        ]}
      />
    </div>
  );
}
