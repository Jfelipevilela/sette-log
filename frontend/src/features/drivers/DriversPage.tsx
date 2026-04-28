import { FormEvent, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  CalendarDays,
  Download,
  Edit2,
  Eye,
  Filter,
  Plus,
  Search,
  Trash2,
  UserRound,
  Paperclip,
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
import { Input } from "../../components/ui/input";
import { DetailModal } from "../../components/ui/detail-modal";
import { Modal } from "../../components/ui/modal";
import { MultiSearchableSelect } from "../../components/ui/multi-searchable-select";
import { SearchableSelect } from "../../components/ui/searchable-select";
import { Table, Td, Th } from "../../components/ui/table";
import {
  apiErrorMessage,
  createDriver,
  deleteDriver,
  downloadDriverAttachment,
  downloadResourceExport,
  fetchDriverAttachmentBlob,
  getDrivers,
  getVehicles,
  uploadDriverAttachment,
  updateDriver,
} from "../../lib/api";
import { labelFor } from "../../lib/labels";
import type { Driver } from "../../lib/types";

import { formatDate } from "../../lib/utils";

const licenseCategoryOptions = ["A", "B", "C", "D", "E"].map((category) => ({
  value: category,
  label: category,
}));

function normalizeLicenseCategories(values: string[]) {
  const allowed = new Set(["A", "B", "C", "D", "E"]);

  return Array.from(
    new Set(
      values
        .flatMap((value) => value.toUpperCase().split(/[^A-Z]+/))
        .filter((value) => allowed.has(value)),
    ),
  )
    .sort()
    .join("");
}

function formatLicenseCategory(value?: string) {
  const normalized = normalizeLicenseCategories([value ?? ""]);
  return normalized ? normalized.split("").join(", ") : "-";
}

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
  const [attachmentFile, setAttachmentFile] = useState<File>();
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [previewAttachment, setPreviewAttachment] = useState<{
    objectUrl?: string;
    fileName: string;
    driverId: string;
    url?: string;
  }>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("");
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
    mutationFn: async (payload: Partial<Driver>) => {
      const created = await createDriver(payload);
      if (attachmentFile) {
        return uploadDriverAttachment(created._id, attachmentFile);
      }
      return created;
    },
    onSuccess: async () => {
      setIsModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["drivers"] });
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () =>
      setFormError(
        "Não foi possível criar o motorista. Verifique CNH e vínculo com veículo.",
      ),
  });
  const updateDriverMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Driver> }) =>
      updateDriver(id, payload).then((updated) => {
        if (!attachmentFile) {
          return updated;
        }
        return uploadDriverAttachment(id, attachmentFile);
      }),
    onSuccess: async () => {
      closeModal();
      await invalidateDriverData();
    },
    onError: (error) =>
      setFormError(
        apiErrorMessage(error, "Não foi possível editar o motorista."),
      ),
  });
  const deleteDriverMutation = useMutation({
    mutationFn: deleteDriver,
    onSuccess: invalidateDriverData,
    onError: (error) =>
      setFormError(
        apiErrorMessage(error, "Não foi possível excluir o motorista."),
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
    setAttachmentFile(undefined);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  }

  function attachmentFileNameFromUrl(url: string) {
    return decodeURIComponent(url.split("/").pop() || "anexo");
  }

  async function openAttachmentPreview(driverId: string, url: string) {
    const fileName = attachmentFileNameFromUrl(url);
    const blob = await fetchDriverAttachmentBlob(driverId, fileName);
    const objectUrl = URL.createObjectURL(blob);
    setPreviewAttachment({
      driverId,
      fileName,
      url: objectUrl,
      objectUrl,
    });
  }

  function closeAttachmentPreview() {
    if (previewAttachment?.objectUrl) {
      URL.revokeObjectURL(previewAttachment.objectUrl);
    }
    setPreviewAttachment(undefined);
  }

  const filteredDrivers = useMemo(() => {
    const term = search.toLowerCase();
    return drivers.filter(
      (driver) =>
        (!term ||
          driver.name.toLowerCase().includes(term) ||
          driver.licenseNumber.toLowerCase().includes(term) ||
          formatLicenseCategory(driver.licenseCategory)
            .toLowerCase()
            .includes(term)) &&
        (!statusFilter || driver.status === statusFilter) &&
        (!categoryFilter ||
          normalizeLicenseCategories([driver.licenseCategory]).includes(
            categoryFilter,
          )) &&
        (!vehicleFilter || driver.assignedVehicleId === vehicleFilter),
    );
  }, [drivers, search, statusFilter, categoryFilter, vehicleFilter]);

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
    const licenseCategory = normalizeLicenseCategories(
      form.getAll("licenseCategory").map((value) => String(value)),
    );

    if (!licenseCategory) {
      setFormError("Selecione ao menos uma categoria de CNH.");
      return;
    }

    const payload = {
      name: String(form.get("name") ?? ""),
      licenseNumber: String(form.get("licenseNumber") ?? ""),
      licenseCategory,
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
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => downloadResourceExport("drivers")}
          >
            <Download size={18} />
            Exportar CSV
          </Button>
          <Button onClick={openCreateModal}>
            <Plus size={18} />
            Novo motorista
          </Button>
        </div>
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
            <div className="mb-4 grid gap-3 lg:grid-cols-[1.2fr_170px_150px_220px_auto]">
              <div className="relative">
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
              <SearchableSelect value={statusFilter} onValueChange={setStatusFilter} placeholder="Status" options={[{ value: "", label: "Todos" }, ...driverStatusOptions]} />
              <SearchableSelect value={categoryFilter} onValueChange={setCategoryFilter} placeholder="Categoria" options={[{ value: "", label: "Todas" }, ...licenseCategoryOptions]} />
              <SearchableSelect value={vehicleFilter} onValueChange={setVehicleFilter} placeholder="Veículo" searchPlaceholder="Buscar veículo" options={[{ value: "", label: "Todos os veículos" }, ...vehicleOptions]} />
              <Button variant="secondary" onClick={() => { setSearch(""); setStatusFilter(""); setCategoryFilter(""); setVehicleFilter(""); }}>
                <Filter size={18} />
                Limpar
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>Nome</Th>
                    <Th>CNH</Th>
                    <Th>Validade</Th>
                    <Th>Score</Th>
                    <Th>Anexos</Th>
                    <Th>Status</Th>
                    <Th>Ações</Th>
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
                          Categoria {formatLicenseCategory(driver.licenseCategory)}
                        </span>
                      </Td>
                      <Td>{formatDate(driver.licenseExpiresAt)}</Td>
                      <Td>
                        <strong>{driver.score}</strong>
                      </Td>
                      <Td>
                        <span className="inline-flex items-center gap-1 text-sm text-zinc-600">
                          <Paperclip size={14} />
                          {driver.attachments?.length ?? 0}
                        </span>
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
        description="Cadastre CNH, contato e opcionalmente vincule um veículo principal."
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
              <MultiSearchableSelect
                name="licenseCategory"
                defaultValue={normalizeLicenseCategories([
                  editingDriver?.licenseCategory ?? "B",
                ]).split("")}
                options={licenseCategoryOptions}
                placeholder="Selecione as categorias"
                searchPlaceholder="Buscar categoria"
              />
              <p className="text-xs font-normal text-zinc-500">
                Marque uma ou mais categorias, como A e B.
              </p>
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
              Veículo principal
              <SearchableSelect
                name="assignedVehicleId"
                defaultValue={editingDriver?.assignedVehicleId ?? ""}
                placeholder="Sem vínculo"
                searchPlaceholder="Buscar placa, modelo ou apelido"
                options={[
                  { value: "", label: "Sem vínculo" },
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
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Anexo do motorista
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
              {editingDriver?.attachments && editingDriver.attachments.length > 0 && (
                <div className="space-y-2 rounded-lg border border-fleet-line bg-white px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Anexos atuais
                  </p>
                  {editingDriver.attachments.map((url) => {
                    const fileName = attachmentFileNameFromUrl(url);
                    return (
                      <button
                        key={url}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-md border border-fleet-line px-3 py-2 text-left text-sm transition hover:bg-zinc-50"
                        onClick={() => void openAttachmentPreview(editingDriver._id, url)}
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
          {
            label: "Categoria",
            value: formatLicenseCategory(detailDriver?.licenseCategory),
          },
          {
            label: "Validade da CNH",
            value: formatDate(detailDriver?.licenseExpiresAt),
          },
          { label: "Telefone", value: detailDriver?.phone },
          { label: "Email", value: detailDriver?.email },
          { label: "Status", value: labelFor(detailDriver?.status) },
          { label: "Score", value: detailDriver?.score },
          {
            label: "Veículo vinculado",
            value: detailDriver?.assignedVehicleId
              ? (vehicles.find(
                  (vehicle) => vehicle._id === detailDriver.assignedVehicleId,
                )?.plate ?? detailDriver.assignedVehicleId)
              : "-",
          },
        ]}
      >
        <div className="rounded-lg border border-fleet-line p-4">
          <strong className="block text-sm text-fleet-ink">Anexos</strong>
          <div className="mt-3 space-y-2">
            {(detailDriver?.attachments?.length ?? 0) === 0 && (
              <p className="text-sm text-zinc-500">
                Nenhum anexo vinculado a este motorista.
              </p>
            )}
            {detailDriver?.attachments?.map((url) => (
              <button
                key={url}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-md border border-fleet-line px-3 py-2 text-left text-sm transition hover:bg-zinc-50"
                onClick={() => void openAttachmentPreview(detailDriver._id, url)}
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
            ? void downloadDriverAttachment(
                previewAttachment.driverId,
                previewAttachment.fileName,
              )
            : undefined
        }
      />
    </div>
  );
}
