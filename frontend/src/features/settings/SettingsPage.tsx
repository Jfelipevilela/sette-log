import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Edit2,
  FileSpreadsheet,
  KeyRound,
  PlugZap,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserMinus,
  UserPlus,
  UsersRound,
  Webhook,
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
import { LoadingState } from "../../components/ui/loading-state";
import { Modal } from "../../components/ui/modal";
import { Pagination } from "../../components/ui/pagination";
import { SearchableSelect } from "../../components/ui/searchable-select";
import { Table, Td, Th } from "../../components/ui/table";
import {
  apiErrorMessage,
  createUser,
  deleteUser,
  getUsersPage,
  saveSetting,
  updateUser,
  uploadLegacySpreadsheet,
} from "../../lib/api";
import { labelFor } from "../../lib/labels";
import type { SystemUser } from "../../lib/types";
import { formatDateTime } from "../../lib/utils";

const settings = [
  {
    icon: UsersRound,
    title: "Usuarios e perfis",
    detail: "RBAC por papel e permissao granular",
    status: "ativo",
  },
  {
    icon: PlugZap,
    title: "Integracoes",
    detail: "ERP, TMS, WMS, mapas e rastreadores",
    status: "preparado",
  },
  {
    icon: Webhook,
    title: "Webhooks",
    detail: "Eventos operacionais assinados por segredo",
    status: "preparado",
  },
  {
    icon: KeyRound,
    title: "Tokens de API",
    detail: "Credenciais para clientes e servicos externos",
    status: "preparado",
  },
];

const importResources = [
  { value: "vehicles", label: "Veiculos" },
  { value: "drivers", label: "Motoristas" },
  { value: "fuel-records", label: "Abastecimentos" },
  { value: "maintenance-orders", label: "Ordens de Manutenção" },
  { value: "documents", label: "Documentos" },
];

const roleOptions = [
  { value: "super_admin", label: "Super Admin" },
  { value: "fleet_manager", label: "Gestor de Frota" },
  { value: "operator", label: "Operador" },
  { value: "maintenance_analyst", label: "Analista de Manutencao" },
  { value: "finance", label: "Financeiro" },
  { value: "driver", label: "Motorista" },
  { value: "auditor", label: "Auditor / Visualizador" },
];

const roleLabels = Object.fromEntries(
  roleOptions.map((role) => [role.value, role.label]),
);

const userStatusOptions = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
  { value: "blocked", label: "Bloqueado" },
];

const statusTone: Record<string, "green" | "amber" | "red" | "neutral"> = {
  active: "green",
  inactive: "amber",
  blocked: "red",
};

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string>();
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [appliedUserSearch, setAppliedUserSearch] = useState("");
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser>();
  const [userError, setUserError] = useState<string>();
  const [importResource, setImportResource] = useState("vehicles");
  const [importFile, setImportFile] = useState<File>();
  const [importResult, setImportResult] =
    useState<Awaited<ReturnType<typeof uploadLegacySpreadsheet>>>();
  const { data: usersPage, isLoading: usersLoading } = useQuery({
    queryKey: ["users", userPage, appliedUserSearch],
    queryFn: () =>
      getUsersPage({
        page: userPage,
        limit: 10,
        search: appliedUserSearch,
        sortBy: "createdAt",
        sortDir: "desc",
      }),
  });
  const saveSettingsMutation = useMutation({
    mutationFn: async (payload: {
      speedLimit: number;
      expirationDays: number;
      idleMinutes: number;
    }) => {
      await Promise.all([
        saveSetting("alerts.speed_limit_kph", payload.speedLimit),
        saveSetting("alerts.document_expiration_days", payload.expirationDays),
        saveSetting("fleet.default_idle_minutes", payload.idleMinutes),
      ]);
    },
    onSuccess: async () => {
      setMessage("Parametros salvos com sucesso.");
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => setMessage("Não foi possivel salvar os parametros."),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!importFile) {
        throw new Error("Selecione um arquivo CSV ou XLSX.");
      }
      return uploadLegacySpreadsheet(importResource, importFile);
    },
    onSuccess: async (result) => {
      setImportResult(result);
      setMessage(
        `Importacao concluida: ${result.imported} inseridos, ${result.updated} atualizados, ${result.failed} falhas.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
        queryClient.invalidateQueries({ queryKey: ["drivers"] }),
        queryClient.invalidateQueries({ queryKey: ["tracking-live"] }),
        queryClient.invalidateQueries({ queryKey: ["maintenance-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["compliance-documents"] }),
      ]);
    },
    onError: (error) => {
      setImportResult(undefined);
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possivel importar a planilha.",
      );
    },
  });

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      closeUserModal();
      setMessage("Usuario criado com sucesso.");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) =>
      setUserError(apiErrorMessage(error, "Não foi possivel criar o usuario.")),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => updateUser(id, payload),
    onSuccess: async () => {
      closeUserModal();
      setMessage("Usuario atualizado com sucesso.");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) =>
      setUserError(
        apiErrorMessage(error, "Não foi possivel atualizar o usuario."),
      ),
  });

  const deleteUserMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: async () => {
      setMessage("Usuario excluido com sucesso.");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) =>
      setMessage(apiErrorMessage(error, "Não foi possivel excluir o usuario.")),
  });

  function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    saveSettingsMutation.mutate({
      speedLimit: Number(form.get("speedLimit") || 90),
      expirationDays: Number(form.get("expirationDays") || 30),
      idleMinutes: Number(form.get("idleMinutes") || 20),
    });
  }

  function openCreateUserModal() {
    setEditingUser(undefined);
    setUserError(undefined);
    setIsUserModalOpen(true);
  }

  function openEditUserModal(user: SystemUser) {
    setEditingUser(user);
    setUserError(undefined);
    setIsUserModalOpen(true);
  }

  function closeUserModal() {
    setEditingUser(undefined);
    setUserError(undefined);
    setIsUserModalOpen(false);
  }

  function handleUserSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserError(undefined);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const payload: Record<string, unknown> = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      roles: [String(form.get("role") ?? "operator")],
      status: String(form.get("status") ?? "active"),
      branchId: String(form.get("branchId") ?? "") || undefined,
    };
    if (password) {
      payload.password = password;
    }
    if (!editingUser && !password) {
      setUserError("Informe uma senha inicial para o novo usuario.");
      return;
    }
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser._id, payload });
      return;
    }
    createUserMutation.mutate(payload);
  }

  const users = usersPage?.data ?? [];

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Configuracoes</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Usuarios, perfis, filiais, alertas, integracoes, webhooks e tokens.
          </p>
        </div>
        <Button
          type="submit"
          form="settings-form"
          disabled={saveSettingsMutation.isPending}
        >
          <ShieldCheck size={18} />
          {saveSettingsMutation.isPending ? "Salvando..." : "Salvar parametros"}
        </Button>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {settings.map((item) => (
          <Card key={item.title} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-100 text-fleet-ink">
                  <item.icon size={20} />
                </span>
                <div>
                  <strong className="block">{item.title}</strong>
                  <p className="mt-1 text-sm text-zinc-500">{item.detail}</p>
                </div>
              </div>
              <Badge tone={item.status === "ativo" ? "green" : "cyan"}>
                {labelFor(item.status)}
              </Badge>
            </div>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Usuarios</CardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              Crie acessos, altere perfis, inative ou exclua usuarios da
              plataforma.
            </p>
          </div>
          <Button type="button" onClick={openCreateUserModal}>
            <UserPlus size={18} />
            Novo usuario
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-2.5 text-zinc-400"
                size={18}
              />
              <Input
                className="pl-10"
                placeholder="Buscar por nome ou email"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setUserPage(1);
                setAppliedUserSearch(userSearch);
              }}
            >
              Filtrar
            </Button>
          </div>

          {usersLoading ? (
            <LoadingState label="Carregando usuarios..." />
          ) : (
            <div className="space-y-4 overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>Nome</Th>
                    <Th>Email</Th>
                    <Th>Perfil</Th>
                    <Th>Status</Th>
                    <Th>Criado em</Th>
                    <Th>Acoes</Th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id}>
                      <Td>
                        <strong>{user.name}</strong>
                        <span className="block text-xs text-zinc-500">
                          {user.branchId ?? "Sem filial"}
                        </span>
                      </Td>
                      <Td>{user.email}</Td>
                      <Td>
                        {user.roles
                          .map((role) => roleLabels[role] ?? role)
                          .join(", ")}
                      </Td>
                      <Td>
                        <Badge tone={statusTone[user.status] ?? "neutral"}>
                          {labelFor(user.status)}
                        </Badge>
                      </Td>
                      <Td>{formatDateTime(user.createdAt)}</Td>
                      <Td>
                        <ActionMenu
                          items={[
                            {
                              label: "Editar",
                              icon: <Edit2 size={15} />,
                              onClick: () => openEditUserModal(user),
                            },
                            {
                              label:
                                user.status === "active"
                                  ? "Inativar"
                                  : "Ativar",
                              icon: <UserMinus size={15} />,
                              disabled: updateUserMutation.isPending,
                              onClick: () =>
                                updateUserMutation.mutate({
                                  id: user._id,
                                  payload: {
                                    status:
                                      user.status === "active"
                                        ? "inactive"
                                        : "active",
                                  },
                                }),
                            },
                            {
                              label: "Excluir",
                              icon: <Trash2 size={15} />,
                              danger: true,
                              disabled: deleteUserMutation.isPending,
                              onClick: () => {
                                if (
                                  window.confirm(
                                    `Excluir o usuario ${user.name}?`,
                                  )
                                ) {
                                  deleteUserMutation.mutate(user._id);
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
                page={usersPage?.meta.page ?? userPage}
                totalPages={usersPage?.meta.totalPages ?? 1}
                total={usersPage?.meta.total ?? 0}
                onPageChange={setUserPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Importar dados antigos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end">
            <label className="space-y-2 text-sm font-medium">
              Tipo de dado
              <SearchableSelect
                value={importResource}
                onValueChange={setImportResource}
                options={importResources}
                searchPlaceholder="Buscar tipo de dado"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Arquivo CSV ou XLSX
              <Input
                type="file"
                accept=".csv,.xlsx"
                onChange={(event) => {
                  setImportFile(event.target.files?.[0]);
                  setImportResult(undefined);
                }}
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <a
                className="inline-flex h-10 items-center justify-center rounded-md border border-fleet-line bg-white px-4 text-sm font-medium text-fleet-ink transition hover:bg-zinc-50"
                href="/templates/sette-log-importacao-template.xlsx"
                download
              >
                Baixar template
              </a>
              <Button
                type="button"
                className="w-full lg:w-auto"
                disabled={!importFile || importMutation.isPending}
                onClick={() => importMutation.mutate()}
              >
                <Upload size={18} />
                {importMutation.isPending ? "Importando..." : "Importar"}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-fleet-line bg-zinc-50 p-4 text-sm text-zinc-600">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="mt-0.5 text-fleet-green" size={18} />
              <div>
                <strong className="block text-zinc-800">
                  Ordem recomendada
                </strong>
                <p className="mt-1">
                  Importe primeiro veiculos e motoristas. Depois suba
                  abastecimentos, manutencoes e documentos, porque essas
                  planilhas usam placa ou CNH para vincular os historicos.
                </p>
                <p className="mt-2">
                  O template possui uma aba para cada tipo de dado. A primeira
                  linha precisa conter os cabecalhos: placa, modelo, marca,
                  odometro, nome, cnh, validade_cnh, litros, valor_total,
                  vencimento.
                </p>
              </div>
            </div>
          </div>

          {importResult && (
            <div className="rounded-lg border border-fleet-line p-4 text-sm">
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <span className="block text-zinc-500">Linhas</span>
                  <strong>{importResult.totalRows}</strong>
                </div>
                <div>
                  <span className="block text-zinc-500">Inseridos</span>
                  <strong>{importResult.imported}</strong>
                </div>
                <div>
                  <span className="block text-zinc-500">Atualizados</span>
                  <strong>{importResult.updated}</strong>
                </div>
                <div>
                  <span className="block text-zinc-500">Falhas</span>
                  <strong>{importResult.failed}</strong>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-4 space-y-2">
                  <strong className="text-zinc-800">
                    Primeiros erros encontrados
                  </strong>
                  {importResult.errors.slice(0, 5).map((error) => (
                    <p
                      key={`${error.row}-${error.message}`}
                      className="text-zinc-600"
                    >
                      Linha {error.row}: {error.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parametros de alerta</CardTitle>
        </CardHeader>
        <CardContent>
          <form id="settings-form" onSubmit={handleSaveSettings}>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2 text-sm font-medium">
                Velocidade maxima
                <Input
                  name="speedLimit"
                  type="number"
                  min="1"
                  defaultValue="90"
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Dias para vencimento
                <Input
                  name="expirationDays"
                  type="number"
                  min="1"
                  defaultValue="30"
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Tempo parado em minutos
                <Input
                  name="idleMinutes"
                  type="number"
                  min="1"
                  defaultValue="20"
                />
              </label>
            </div>
            {message && <p className="mt-4 text-sm text-zinc-600">{message}</p>}
          </form>
        </CardContent>
      </Card>

      <Modal
        open={isUserModalOpen}
        title={editingUser ? "Editar usuario" : "Novo usuario"}
        description={
          editingUser
            ? "Atualize dados, perfil e status de acesso."
            : "Crie um novo acesso para a plataforma."
        }
        onClose={closeUserModal}
      >
        <form className="space-y-4" onSubmit={handleUserSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Nome
              <Input name="name" defaultValue={editingUser?.name} required />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Email
              <Input
                name="email"
                type="email"
                defaultValue={editingUser?.email}
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Perfil
              <SearchableSelect
                name="role"
                defaultValue={editingUser?.roles?.[0] ?? "operator"}
                options={roleOptions}
                searchPlaceholder="Buscar perfil"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Status
              <SearchableSelect
                name="status"
                defaultValue={editingUser?.status ?? "active"}
                options={userStatusOptions}
                searchPlaceholder="Buscar status"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Senha {editingUser ? "(opcional)" : ""}
              <Input
                name="password"
                type="password"
                minLength={8}
                placeholder={
                  editingUser ? "Manter senha atual" : "Minimo 8 caracteres"
                }
                required={!editingUser}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Filial
              <Input
                name="branchId"
                defaultValue={editingUser?.branchId}
                placeholder="Opcional"
              />
            </label>
          </div>
          {userError && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {userError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeUserModal}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                createUserMutation.isPending || updateUserMutation.isPending
              }
            >
              {createUserMutation.isPending || updateUserMutation.isPending
                ? "Salvando..."
                : "Salvar usuario"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
