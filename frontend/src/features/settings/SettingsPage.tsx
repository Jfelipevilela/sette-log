import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FileCode2,
  Edit2,
  Eye,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  PlugZap,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
  UserMinus,
  UserPlus,
  UsersRound,
  Webhook,
  X,
  Plus,
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
import { MultiSearchableSelect } from "../../components/ui/multi-searchable-select";
import { Pagination } from "../../components/ui/pagination";
import { SearchableSelect } from "../../components/ui/searchable-select";
import { Table, Td, Th } from "../../components/ui/table";
import {
  apiErrorMessage,
  createRole,
  createUser,
  deleteRole,
  disableUserApiAccess,
  deleteUser,
  downloadImportTemplate,
  enableUserApiAccess,
  getRoles,
  getSettingsParameters,
  getUsersPage,
  saveSetting,
  updateRole,
  updateUser,
  uploadLegacySpreadsheet,
  uploadCompleteLegacySpreadsheet,
} from "../../lib/api";
import { labelFor } from "../../lib/labels";
import type { PermissionGroup, SystemUser } from "../../lib/types";
import { formatDateTime } from "../../lib/utils";

const settings = [
  {
    icon: UsersRound,
    title: "UsuÃ¡rios e perfis",
    detail: "RBAC por perfil e permissao granular",
    status: "ativo",
  },
  {
    icon: PlugZap,
    title: "IntegraÃ§Ãµes",
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
    detail: "Credenciais para clientes e serviÃ§os externos",
    status: "preparado",
  },
];

const importResources = [
  { value: "vehicles", label: "Veí­culos" },
  { value: "drivers", label: "Motoristas" },
  { value: "fuel-records", label: "Abastecimentos" },
  { value: "maintenance-orders", label: "Ordens de Manutenção" },
  { value: "expenses", label: "Despesas" },
  { value: "documents", label: "Documentos" },
];

type ResourceMeta = {
  step: number;
  color: string;
  bgColor: string;
  borderColor: string;
  required: string[];
  optional: string[];
  hint: string;
  depends?: string;
};

const resourceMeta: Record<string, ResourceMeta> = {
  vehicles: {
    step: 1,
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    required: ["placa", "marca", "modelo"],
    optional: [
      "apelido",
      "ano",
      "tipo",
      "status",
      "odometro",
      "odometro_base_consumo",
      "capacidade_tanque",
      "centro_custo",
    ],
    hint: "Se a placa jÃ¡ existir, o veÃ­culo serÃ¡ atualizado. Preencha odÃ´metro_base_consumo para calcular o primeiro km/L.",
  },
  drivers: {
    step: 2,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    required: ["nome", "cnh", "categoria_cnh", "validade_cnh"],
    optional: ["cpf", "telefone", "email", "status"],
    hint: "Se o nÃºmero de CNH jÃ¡ existir, o motorista serÃ¡ atualizado. Pode ser importado junto com veÃ­culos.",
  },
  "fuel-records": {
    step: 3,
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    required: ["placa", "litros", "valor_total"],
    optional: [
      "cnh",
      "preco_litro",
      "odometro",
      "data_abastecimento",
      "posto",
      "combustÃ­vel",
    ],
    hint: "Sempre inserido como novo registro. Preencha o odÃ´metro para calcular km/litro automaticamente.",
    depends: "Requer veÃ­culos (e opcionalmente motoristas) jÃ¡ importados.",
  },
  "maintenance-orders": {
    step: 4,
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    required: ["placa"],
    optional: [
      "tipo",
      "prioridade",
      "status",
      "agendamento",
      "odometro",
      "valor_total",
      "descricao",
    ],
    hint: "Sempre inserida como nova ordem. tipo: preventiva, corretiva, preditiva.",
    depends: "Requer veÃ­culos jÃ¡ importados.",
  },
  expenses: {
    step: 5,
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    required: ["categoria", "descricao", "valor", "data"],
    optional: [
      "placa",
      "cnh",
      "subcategoria",
      "centro_custo",
      "fornecedor",
      "numero_documento",
    ],
    hint: "Importa despesas operacionais e financeiras para compor Outras despesas no dashboard e no financeiro.",
    depends:
      "Placa e CNH são opcionais, mas se informados precisam existir no sistema.",
  },
  documents: {
    step: 6,
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    required: ["entidade", "referencia", "documento"],
    optional: ["numero", "emissao", "vencimento", "url"],
    hint: "entidade = veículos ou motorista | referencia = placa ou CNH | documento = crlv, ipva, cnh, seguro...",
    depends: "Requer veículos e/ou motoristas já importados.",
  },
};

const roleOptions = [
  { value: "super_admin", label: "Super Admin" },
  // { value: "fleet_manager", label: "Gestor de Frota" },
  // { value: "operator", label: "Operador" },
  // { value: "maintenance_analyst", label: "Analista de ManutenManutençãoo" },
  // { value: "finance", label: "Financeiro" },
  // { value: "driver", label: "Motorista" },
  // { value: "auditor", label: "Auditor / Visualizador" },
];

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

const permissionOptions = [
  { value: "dashboard:view", label: "Dashboard - visualizar" },
  { value: "vehicles:view", label: "Veiculos - visualizar" },
  { value: "vehicles:create", label: "Veiculos - criar" },
  { value: "vehicles:edit", label: "Veiculos - editar" },
  { value: "vehicles:delete", label: "Veiculos - excluir" },
  { value: "tracking:view", label: "Rastreamento - visualizar" },
  { value: "tracking:export", label: "Rastreamento - exportar" },
  { value: "drivers:view", label: "Motoristas - visualizar" },
  { value: "drivers:create", label: "Motoristas - criar" },
  { value: "drivers:edit", label: "Motoristas - editar" },
  { value: "drivers:delete", label: "Motoristas - excluir" },
  { value: "maintenance:view", label: "Manutencao - visualizar" },
  { value: "maintenance:create", label: "Manutencao - criar" },
  { value: "maintenance:edit", label: "Manutencao - editar" },
  { value: "maintenance:delete", label: "Manutencao - excluir" },
  { value: "finance:view", label: "Financeiro - visualizar" },
  { value: "finance:create", label: "Financeiro - criar" },
  { value: "finance:edit", label: "Financeiro - editar" },
  { value: "finance:delete", label: "Financeiro - excluir" },
  {
    value: "fuel_driver_portal:access",
    label: "Abastecimento do tecnico - acessar portal",
  },
  { value: "compliance:view", label: "Compliance - visualizar" },
  { value: "compliance:create", label: "Compliance - criar" },
  { value: "compliance:edit", label: "Compliance - editar" },
  { value: "compliance:delete", label: "Compliance - excluir" },
  { value: "reports:view", label: "Relatorios - visualizar" },
  { value: "reports:export", label: "Relatorios - exportar" },
  { value: "settings:manage", label: "Configuracoes - gerenciar" },
  { value: "users:manage", label: "Usuarios - gerenciar" },
  { value: "integrations:manage", label: "Integracoes - gerenciar" },
  { value: "alerts:manage", label: "Alertas - gerenciar" },
];

type FineCatalogItem = {
  code: string;
  title: string;
  description?: string;
};

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string>();
  const [maintenanceCatalogMessage, setMaintenanceCatalogMessage] =
    useState<string>();
  const [fineCatalogMessage, setFineCatalogMessage] = useState<string>();
  const [fineCatalogDraft, setFineCatalogDraft] = useState<FineCatalogItem[]>(
    [],
  );
  const [maintenanceCostCentersDraft, setMaintenanceCostCentersDraft] =
    useState<string[]>([]);
  const [maintenanceServicesDraft, setMaintenanceServicesDraft] = useState<
    string[]
  >([]);
  const [maintenanceGroupsDraft, setMaintenanceGroupsDraft] = useState<
    string[]
  >([]);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [appliedUserSearch, setAppliedUserSearch] = useState("");
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser>();
  const [detailUser, setDetailUser] = useState<SystemUser>();
  const [apiTokenModal, setApiTokenModal] = useState<{
    userId: string;
    userName: string;
    token: string;
  }>();
  const [apiTokensByUser, setApiTokensByUser] = useState<
    Record<string, string>
  >({});
  const [userError, setUserError] = useState<string>();
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<PermissionGroup>();
  const [roleError, setRoleError] = useState<string>();
  const [rolesExpanded, setRolesExpanded] = useState(true);
  const [importResource, setImportResource] = useState("vehicles");
  const [importFile, setImportFile] = useState<File>();
  const [recalculateFuelTotal, setRecalculateFuelTotal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<
    | Awaited<ReturnType<typeof uploadLegacySpreadsheet>>
    | Awaited<ReturnType<typeof uploadCompleteLegacySpreadsheet>>
  >();

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
  const { data: settingsParameters = [] } = useQuery({
    queryKey: ["settings-parameters"],
    queryFn: () => getSettingsParameters(),
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: () => getRoles(),
  });
  const settingValue = (key: string) =>
    settingsParameters.find((item) => item.key === key)?.value;
  const maintenanceCostCenters = Array.isArray(
    settingValue("maintenance.cost_centers"),
  )
    ? (settingValue("maintenance.cost_centers") as string[])
    : [];
  const maintenanceServices = Array.isArray(
    settingValue("maintenance.services_catalog"),
  )
    ? (settingValue("maintenance.services_catalog") as string[])
    : [];
  const maintenanceGroups = Array.isArray(
    settingValue("maintenance.parts_catalog"),
  )
    ? (settingValue("maintenance.parts_catalog") as string[])
    : [];
  const fineCatalog = Array.isArray(settingValue("finance.fine_catalog"))
    ? (settingValue("finance.fine_catalog") as FineCatalogItem[])
    : [];
  const customRoleOptions = roles
    .filter((role) => !role.system)
    .map((role) => ({
      value: role.key,
      label: role.name,
      searchText: `${role.key} ${role.name} ${role.description ?? ""}`,
    }));
  const availableRoleOptions = [
    ...roleOptions,
    ...customRoleOptions.filter(
      (customRole) =>
        !roleOptions.some((baseRole) => baseRole.value === customRole.value),
    ),
  ];
  const resolvedRoleLabels = Object.fromEntries(
    availableRoleOptions.map((role) => [role.value, role.label]),
  );

  useEffect(() => {
    setFineCatalogDraft(fineCatalog.length > 0 ? fineCatalog : []);
    setMaintenanceCostCentersDraft(
      maintenanceCostCenters.length > 0 ? maintenanceCostCenters : [],
    );
    setMaintenanceServicesDraft(
      maintenanceServices.length > 0 ? maintenanceServices : [],
    );
    setMaintenanceGroupsDraft(
      maintenanceGroups.length > 0 ? maintenanceGroups : [],
    );
  }, [settingsParameters]);
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
      setMessage("Grupos salvos com sucesso.");
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () =>
      setMessage("Não foi possível salvar os grupos de parâmetros."),
  });

  const saveMaintenanceCatalogMutation = useMutation({
    mutationFn: async (payload: {
      costCenters: string[];
      services: string[];
      groups: string[];
    }) => {
      await Promise.all([
        saveSetting("maintenance.cost_centers", payload.costCenters),
        saveSetting("maintenance.services_catalog", payload.services),
        saveSetting("maintenance.parts_catalog", payload.groups),
      ]);
    },
    onSuccess: async () => {
      setMaintenanceCatalogMessage("Catálogo de manutenção salvo com sucesso.");
      await queryClient.invalidateQueries({
        queryKey: ["settings-parameters"],
      });
    },
    onError: () =>
      setMaintenanceCatalogMessage(
        "Não foi possível salvar o catálogo de manutenção.",
      ),
  });

  const saveFineCatalogMutation = useMutation({
    mutationFn: async (items: FineCatalogItem[]) => {
      await saveSetting(
        "finance.fine_catalog",
        items
          .map((item) => ({
            code: item.code.trim(),
            title: item.title.trim(),
            description: item.description?.trim() || undefined,
          }))
          .filter((item) => item.code && item.title),
      );
    },
    onSuccess: async () => {
      setFineCatalogMessage("Catálogo de multas salvo com sucesso.");
      await queryClient.invalidateQueries({
        queryKey: ["settings-parameters"],
      });
    },
    onError: () =>
      setFineCatalogMessage("Não foi possível salvar o catálogo de multas."),
  });

  const createRoleMutation = useMutation({
    mutationFn: createRole,
    onSuccess: async () => {
      closeRoleModal();
      setMessage("Grupo de permissões criado com sucesso.");
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error) =>
      setRoleError(
        apiErrorMessage(error, "Não foi possível criar o grupo de permissões."),
      ),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => updateRole(id, payload),
    onSuccess: async () => {
      closeRoleModal();
      setMessage("Grupo de permissões atualizado com sucesso.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["roles"] }),
        queryClient.invalidateQueries({ queryKey: ["users"] }),
      ]);
    },
    onError: (error) =>
      setRoleError(
        apiErrorMessage(
          error,
          "Não foi possível atualizar o grupo de permissões.",
        ),
      ),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: async () => {
      setMessage("Grupo de permissões excluído com sucesso.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["roles"] }),
        queryClient.invalidateQueries({ queryKey: ["users"] }),
      ]);
    },
    onError: (error) =>
      setMessage(
        apiErrorMessage(
          error,
          "Não foi possível excluir o grupo de permissões.",
        ),
      ),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!importFile) {
        throw new Error("Selecione um arquivo CSV ou XLSX.");
      }
      return uploadLegacySpreadsheet(importResource, importFile, {
        recalculateFuelTotal,
      });
    },
    onSuccess: async (result) => {
      setImportResult(result);
      setMessage(
        `Importação concluída: ${result.imported} inseridos, ${result.updated} atualizados, ${result.failed} falhas.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
        queryClient.invalidateQueries({ queryKey: ["drivers"] }),
        queryClient.invalidateQueries({ queryKey: ["tracking-live"] }),
        queryClient.invalidateQueries({ queryKey: ["fuel-records"] }),
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
          : "Não foi possível importar a planilha.",
      );
    },
  });

  const completeImportMutation = useMutation({
    mutationFn: async () => {
      if (!importFile) {
        throw new Error("Selecione um arquivo CSV ou XLSX.");
      }
      return uploadCompleteLegacySpreadsheet(importFile, {
        recalculateFuelTotal,
      });
    },
    onSuccess: async (result) => {
      setImportResult(result as any);
      const totalImported = result.summary.totalImported;
      const totalUpdated = result.summary.totalUpdated;
      const totalFailed = result.summary.totalFailed;
      setMessage(
        `Importação completa concluída: ${totalImported} inseridos, ${totalUpdated} atualizados, ${totalFailed} falhas.`,
      );
      setImportFile(undefined);
      fileInputRef.current?.removeAttribute("value");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
        queryClient.invalidateQueries({ queryKey: ["drivers"] }),
        queryClient.invalidateQueries({ queryKey: ["tracking-live"] }),
        queryClient.invalidateQueries({ queryKey: ["fuel-records"] }),
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
          : "Não foi possível importar a planilha completa.",
      );
    },
  });

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      closeUserModal();
      setMessage("Usuário criado com sucesso.");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) =>
      setUserError(apiErrorMessage(error, "Não foi possível criar o usuário.")),
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
      setMessage("Usuário atualizado com sucesso.");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) =>
      setUserError(
        apiErrorMessage(error, "Não foi possível atualizar o usuário."),
      ),
  });

  const deleteUserMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: async () => {
      setMessage("Usuário excluído com sucesso.");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) =>
      setMessage(apiErrorMessage(error, "Não foi possível excluir o usuário.")),
  });

  const enableApiAccessMutation = useMutation({
    mutationFn: enableUserApiAccess,
    onSuccess: async (result) => {
      setApiTokensByUser((current) => ({
        ...current,
        [result.user._id]: result.apiToken,
      }));
      setApiTokenModal({
        userId: result.user._id,
        userName: result.user.name,
        token: result.apiToken,
      });
      setDetailUser((current) =>
        current?._id === result.user._id ? result.user : current,
      );
      setMessage("Token de API gerado com sucesso.");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) =>
      setMessage(
        apiErrorMessage(error, "Não foi possível gerar o token de API."),
      ),
  });

  const disableApiAccessMutation = useMutation({
    mutationFn: disableUserApiAccess,
    onSuccess: async (user) => {
      setApiTokensByUser((current) => {
        const next = { ...current };
        delete next[user._id];
        return next;
      });
      setDetailUser((current) => (current?._id === user._id ? user : current));
      setMessage("Acesso Ã  API removido com sucesso.");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) =>
      setMessage(
        apiErrorMessage(error, "Não foi possível remover o acesso à API."),
      ),
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

  function normalizeDraftList(items: string[]) {
    return Array.from(
      new Set(items.map((item) => item.trim()).filter(Boolean)),
    );
  }

  function handleSaveMaintenanceCatalog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveMaintenanceCatalogMutation.mutate({
      costCenters: normalizeDraftList(maintenanceCostCentersDraft),
      services: normalizeDraftList(maintenanceServicesDraft),
      groups: normalizeDraftList(maintenanceGroupsDraft),
    });
  }

  function handleSaveFineCatalog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedItems = fineCatalogDraft
      .map((item) => ({
        code: item.code.trim(),
        title: item.title.trim(),
        description: item.description?.trim() || undefined,
      }))
      .filter((item) => item.code || item.title);

    const invalidItem = normalizedItems.find(
      (item) => !item.code || !item.title,
    );
    if (invalidItem) {
      setFineCatalogMessage("Preencha código e título em todas as multas.");
      return;
    }

    saveFineCatalogMutation.mutate(normalizedItems);
  }

  function openCreateRoleModal() {
    setEditingRole(undefined);
    setRoleError(undefined);
    setIsRoleModalOpen(true);
  }

  function openEditRoleModal(role: PermissionGroup) {
    setEditingRole(role);
    setRoleError(undefined);
    setIsRoleModalOpen(true);
  }

  function closeRoleModal() {
    setEditingRole(undefined);
    setRoleError(undefined);
    setIsRoleModalOpen(false);
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
      setUserError("Informe uma senha inicial para o novo usuário.");
      return;
    }
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser._id, payload });
      return;
    }
    createUserMutation.mutate(payload);
  }

  function handleRoleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRoleError(undefined);
    const form = new FormData(event.currentTarget);
    const permissions = form.getAll("permissions").map(String);
    const payload = {
      key: String(form.get("key") ?? ""),
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? "") || undefined,
      status: String(form.get("status") ?? "active"),
      permissions,
    };

    if (!payload.name.trim()) {
      setRoleError("Informe o nome do grupo.");
      return;
    }
    if (permissions.length === 0) {
      setRoleError("Selecione pelo menos uma permissão.");
      return;
    }

    if (editingRole?._id) {
      updateRoleMutation.mutate({ id: editingRole._id, payload });
      return;
    }
    createRoleMutation.mutate(payload);
  }

  const users = usersPage?.data ?? [];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-lg border border-fleet-line bg-white p-5 shadow-sm md:p-6">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fleet-green via-cyan-500 to-fleet-amber" />
        <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <span className="mb-2 inline-flex rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold uppercase text-emerald-700">
              Administração
            </span>
            <h2 className="text-2xl font-semibold text-fleet-ink">
              Configurações
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Usuários, perfis, filiais, alertas, integrações, webhooks e
              tokens.
            </p>
          </div>
          <Button
            type="submit"
            form="settings-form"
            disabled={saveSettingsMutation.isPending}
          >
            <ShieldCheck size={18} />
            {saveSettingsMutation.isPending
              ? "Salvando..."
              : "Salvar grupos de parâmetros"}
          </Button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {settings.map((item) => (
          <Card
            key={item.title}
            className="group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.10)]"
          >
            <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-fleet-green to-cyan-500" />
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                  <item.icon size={20} />
                </span>
                <div>
                  <strong className="block text-fleet-ink">{item.title}</strong>
                  <p className="mt-1 text-sm leading-6 text-zinc-500">
                    {item.detail}
                  </p>
                </div>
              </div>
              <Badge tone={item.status === "ativo" ? "green" : "cyan"}>
                {labelFor(item.status)}
              </Badge>
            </div>
          </Card>
        ))}
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-sky-50 via-white to-emerald-50">
          <div>
            <CardTitle>Documentação da API</CardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              Acesse a central pública de integração com exemplos de requisição,
              resposta, erros HTTP, filtros por módulo e coleções para Postman e
              Insomnia.
            </p>
          </div>
          <Button
            type="button"
            onClick={() =>
              window.open("/api-docs", "_blank", "noopener,noreferrer")
            }
          >
            <FileCode2 size={18} />
            Abrir documentação
          </Button>
        </CardHeader>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-zinc-50 via-white to-emerald-50">
          <div>
            <CardTitle>Usuários</CardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              Crie acessos, altere perfis, inative ou exclua usuários da
              plataforma.
            </p>
          </div>
          <Button type="button" onClick={openCreateUserModal}>
            <UserPlus size={18} />
            Novo usuário
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
            <LoadingState label="Carregando usuÃ¡rios..." />
          ) : (
            <div className="space-y-4 overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>Nome</Th>
                    <Th>Email</Th>
                    <Th>Perfil</Th>
                    <Th>Status</Th>
                    <Th>API</Th>
                    <Th>Criado em</Th>
                    <Th>Ações</Th>
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
                          .map((role) => resolvedRoleLabels[role] ?? role)
                          .join(", ")}
                      </Td>
                      <Td>
                        <Badge tone={statusTone[user.status] ?? "neutral"}>
                          {labelFor(user.status)}
                        </Badge>
                      </Td>
                      <Td>
                        {user.apiAccessEnabled ? (
                          <div className="space-y-1">
                            <Badge tone="green">Habilitado</Badge>
                          </div>
                        ) : (
                          <Badge tone="neutral">Desabilitado</Badge>
                        )}
                      </Td>
                      <Td>{formatDateTime(user.createdAt)}</Td>
                      <Td>
                        <ActionMenu
                          items={[
                            {
                              label: "Detalhes",
                              icon: <Eye size={15} />,
                              onClick: () => setDetailUser(user),
                            },
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
                              label: user.apiAccessEnabled
                                ? "Regenerar token API"
                                : "Gerar token API",
                              icon: <KeyRound size={15} />,
                              disabled: enableApiAccessMutation.isPending,
                              onClick: () =>
                                enableApiAccessMutation.mutate(user._id),
                            },
                            {
                              label: "Revogar acesso API",
                              icon: <X size={15} />,
                              danger: true,
                              disabled:
                                !user.apiAccessEnabled ||
                                disableApiAccessMutation.isPending,
                              onClick: () => {
                                if (
                                  window.confirm(
                                    `Revogar o acesso à API do usuário ${user.name}?`,
                                  )
                                ) {
                                  disableApiAccessMutation.mutate(user._id);
                                }
                              },
                            },
                            {
                              label: "Excluir",
                              icon: <Trash2 size={15} />,
                              danger: true,
                              disabled: deleteUserMutation.isPending,
                              onClick: () => {
                                if (
                                  window.confirm(
                                    `Excluir o usuÃ¡rio ${user.name}?`,
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

      {/* ï¿½?????ï¿½ï¿½?????ï¿½ Importar dados antigos ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ï¿½?????ï¿½ */}
      <Card className="overflow-hidden">
        <CardHeader className="relative bg-gradient-to-r from-emerald-50 via-white to-cyan-50">
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fleet-green via-cyan-500 to-fleet-amber" />
          <div>
            <CardTitle>Importar dados antigos</CardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              Suba planilhas CSV ou XLSX para migrar histórico de frotas
              legadas.
            </p>
          </div>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-fleet-line bg-white px-3 text-sm font-medium text-fleet-ink transition hover:bg-zinc-50 hover:border-zinc-300 flex-shrink-0 disabled:opacity-50"
            onClick={async () => {
              try {
                await downloadImportTemplate();
                setMessage("Template baixado com sucesso.");
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Não foi possível baixar o template.",
                );
              }
            }}
            disabled={false}
          >
            <FileSpreadsheet size={15} className="text-fleet-green" />
            Baixar template
          </button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step flow */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-zinc-500">
            {importResources.map((r, idx) => {
              const meta = resourceMeta[r.value]!;
              const isActive = importResource === r.value;
              return (
                <div key={r.value} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setImportResource(r.value);
                      setImportResult(undefined);
                      setImportFile(undefined);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className={[
                      "flex items-center gap-1.5 rounded-full border px-3 py-1 transition-all",
                      isActive
                        ? `${meta.bgColor} ${meta.borderColor} ${meta.color} font-semibold shadow-sm`
                        : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
                        isActive ? "bg-current/10" : "bg-zinc-100",
                      ].join(" ")}
                      style={
                        isActive
                          ? { backgroundColor: "currentcolor", color: "white" }
                          : {}
                      }
                    >
                      {meta.step}
                    </span>
                    {r.label}
                  </button>
                  {idx < importResources.length - 1 && (
                    <ChevronRight
                      size={12}
                      className="text-zinc-300 flex-shrink-0"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Resource hint */}
          {(() => {
            const meta = resourceMeta[importResource]!;
            return (
              <div
                className={`rounded-lg border ${meta.borderColor} ${meta.bgColor} p-4 text-sm`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        Obrigatórios
                      </span>
                      {meta.required.map((col) => (
                        <span
                          key={col}
                          className={`inline-flex rounded px-1.5 py-0.5 text-xs font-mono font-semibold ${meta.bgColor} ${meta.color} border ${meta.borderColor}`}
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        Opcionais
                      </span>
                      {meta.optional.map((col) => (
                        <span
                          key={col}
                          className="inline-flex rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-xs font-mono text-zinc-500"
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="sm:max-w-xs space-y-1 text-xs text-zinc-600 border-t border-zinc-200/60 pt-2 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-4">
                    <p>{meta.hint}</p>
                    {meta.depends && (
                      <p className="flex items-start gap-1 font-medium text-amber-700">
                        <TriangleAlert
                          size={12}
                          className="mt-0.5 flex-shrink-0"
                        />
                        {meta.depends}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Drop zone */}
          <div
            className={[
              "relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all",
              isDragging
                ? "border-fleet-green bg-emerald-50 scale-[1.01]"
                : importFile
                  ? "border-fleet-green/50 bg-emerald-50/50"
                  : "border-zinc-200 bg-zinc-50/60 hover:border-zinc-300 hover:bg-zinc-50",
            ].join(" ")}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (
                file &&
                (file.name.endsWith(".csv") || file.name.endsWith(".xlsx"))
              ) {
                setImportFile(file);
                setImportResult(undefined);
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="sr-only"
              onChange={(e) => {
                setImportFile(e.target.files?.[0]);
                setImportResult(undefined);
              }}
            />
            {importFile ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-fleet-green/10">
                  <FileSpreadsheet size={24} className="text-fleet-green" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-fleet-ink">
                    {importFile.name}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {(importFile.size / 1024).toFixed(1)} KB. Clique para trocar
                  </p>
                </div>
                <button
                  type="button"
                  className="absolute right-3 top-3 rounded-full p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImportFile(undefined);
                    setImportResult(undefined);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
                  <Upload size={22} className="text-zinc-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-zinc-700">
                    Arraste o arquivo ou{" "}
                    <span className="text-fleet-green underline underline-offset-2">
                      clique para selecionar
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    CSV ou XLSX Â· máximo 5.000 linhas
                  </p>
                </div>
              </>
            )}
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-950">
            <input
              type="checkbox"
              checked={recalculateFuelTotal}
              onChange={(event) =>
                setRecalculateFuelTotal(event.target.checked)
              }
              className="mt-1 h-4 w-4 rounded border-emerald-300 text-emerald-700"
            />
            <span>
              <strong>Recalcular valor total dos abastecimentos</strong>
              <span className="mt-1 block text-xs text-emerald-800">
                Quando marcado, o sistema ignora o valor_total incorreto da
                planilha e grava o total como litros x preco_litro.
              </span>
            </span>
          </label>

          {/* Action buttons */}
          <div className="space-y-4">
            {/* Import by resource type */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs font-medium text-zinc-600 mb-2">
                  Importar por tipo (um de cada vez):
                </p>
                <SearchableSelect
                  options={importResources}
                  value={importResource}
                  onValueChange={(value) => setImportResource(value)}
                  placeholder="Selecione o tipo de dados"
                />
              </div>
              <Button
                type="button"
                disabled={!importFile || importMutation.isPending}
                onClick={() => importMutation.mutate()}
                className="flex-shrink-0 gap-2 mt-6"
              >
                {importMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
                {importMutation.isPending ? "Importando..." : "Importar"}
              </Button>
            </div>

            {/* Import complete spreadsheet */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <p className="text-sm font-medium text-emerald-900 mb-3">
                Ou importe tudo de uma vez!
              </p>
              <Button
                type="button"
                disabled={!importFile || completeImportMutation.isPending}
                onClick={() => completeImportMutation.mutate()}
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                {completeImportMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={16} />
                )}
                {completeImportMutation.isPending
                  ? "Importando planilha completa..."
                  : "Importar planilha completa (todos os dados)"}
              </Button>
              <p className="mt-2 text-xs text-emerald-800">
                Preencha todos os dados da planilha (veículos, motoristas,
                abastecimentos, manutenções e documentos) e faça upload uma
                única vez.
              </p>
            </div>
          </div>

          {/* Result panel */}
          {importResult && (
            <div className="space-y-4">
              {/* If complete spreadsheet result */}
              {"totalResources" in importResult ? (
                <div className="rounded-xl border border-fleet-line overflow-hidden">
                  {/* Complete import summary */}
                  <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-3">
                    <p className="text-sm font-semibold text-emerald-900">
                      Importação completa realizada com sucesso!
                    </p>
                  </div>

                  {/* Overall stats */}
                  <div className="grid grid-cols-3 divide-x divide-fleet-line px-4 py-4">
                    <div>
                      <p className="text-xs text-zinc-500">Abas processadas</p>
                      <p className="text-2xl font-bold text-zinc-700">
                        {importResult.totalResources}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Total inseridos</p>
                      <p className="text-2xl font-bold text-emerald-700">
                        {importResult.summary.totalImported}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Total atualizados</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {importResult.summary.totalUpdated}
                      </p>
                    </div>
                  </div>

                  {/* Individual results */}
                  <div className="border-t border-fleet-line">
                    {importResult.results.map((result) => (
                      <div
                        key={result.resource}
                        className="border-b border-fleet-line last:border-b-0 px-4 py-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-zinc-800 capitalize">
                              {result.resource === "fuel-records"
                                ? "Abastecimentos"
                                : result.resource === "maintenance-orders"
                                  ? "ManutenÃ§Ãµes"
                                  : result.resource === "vehicles"
                                    ? "VeÃ­culos"
                                    : result.resource === "drivers"
                                      ? "Motoristas"
                                      : "Documentos"}
                            </p>
                            <p className="text-xs text-zinc-500 mt-1">
                              {result.totalRows} linhas Â· {result.imported}{" "}
                              inseridos Â· {result.updated} atualizados
                              {result.failed > 0 && (
                                <span className="text-red-600">
                                  {" "}
                                  Â· {result.failed} erros
                                </span>
                              )}
                            </p>
                          </div>
                          {result.failed === 0 ? (
                            <CheckCircle2
                              size={20}
                              className="text-emerald-600"
                            />
                          ) : (
                            <AlertCircle size={20} className="text-amber-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Show errors if any */}
                  {importResult.results.some((r) => r.errors.length > 0) && (
                    <div className="border-t border-fleet-line bg-red-50/50 px-4 py-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                        Erros encontrados
                      </p>
                      {importResult.results.map(
                        (result) =>
                          result.errors.length > 0 && (
                            <div key={result.resource} className="space-y-2">
                              <p className="text-xs font-medium text-red-800 capitalize">
                                {result.resource === "fuel-records"
                                  ? "Abastecimentos"
                                  : result.resource === "maintenance-orders"
                                    ? "Manutenções"
                                    : result.resource}
                              </p>
                              {result.errors.slice(0, 3).map((error) => (
                                <div
                                  key={`${error.row}-${error.message}`}
                                  className="flex items-start gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-xs"
                                >
                                  <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono font-bold text-red-700 flex-shrink-0">
                                    L{error.row}
                                  </span>
                                  <span className="text-zinc-600">
                                    {error.message}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ),
                      )}
                    </div>
                  )}
                </div>
              ) : (
                // Single resource result (original behavior)
                <div className="rounded-xl border border-fleet-line overflow-hidden">
                  {/* Stats header */}
                  <div
                    className={[
                      "grid grid-cols-2 md:grid-cols-4 divide-x divide-fleet-line",
                      importResult.failed > 0
                        ? "bg-amber-50 border-b border-amber-200"
                        : "bg-emerald-50 border-b border-emerald-100",
                    ].join(" ")}
                  >
                    {[
                      {
                        label: "Total de linhas",
                        value: importResult.totalRows,
                        color: "text-zinc-700",
                        bg: "",
                      },
                      {
                        label: "Inseridos",
                        value: importResult.imported,
                        color: "text-emerald-700",
                        bg: "bg-emerald-50",
                      },
                      {
                        label: "Atualizados",
                        value: importResult.updated,
                        color: "text-blue-700",
                        bg: "",
                      },
                      {
                        label: "Falhas",
                        value: importResult.failed,
                        color:
                          importResult.failed > 0
                            ? "text-red-700"
                            : "text-zinc-400",
                        bg: importResult.failed > 0 ? "bg-red-50" : "",
                      },
                    ].map((stat) => (
                      <div key={stat.label} className={`px-4 py-3 ${stat.bg}`}>
                        <p className="text-xs text-zinc-500">{stat.label}</p>
                        <p className={`text-2xl font-bold ${stat.color}`}>
                          {stat.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  {/* Summary line */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-white text-sm">
                    {importResult.failed === 0 ? (
                      <CheckCircle2
                        size={16}
                        className="text-fleet-green flex-shrink-0"
                      />
                    ) : (
                      <AlertCircle
                        size={16}
                        className="text-amber-500 flex-shrink-0"
                      />
                    )}
                    <span className="text-zinc-600">
                      Arquivo:{" "}
                      <span className="font-medium text-zinc-800">
                        {importResult.fileName}
                      </span>
                      {importResult.failed === 0
                        ? " importado com sucesso!"
                        : `${importResult.failed} linha(s) com erro. Corrija e reimporte.`}
                    </span>
                  </div>
                  {/* Errors */}
                  {importResult.errors.length > 0 && (
                    <div className="border-t border-fleet-line bg-red-50/50 px-4 py-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                        Erros encontrados (primeiros{" "}
                        {Math.min(importResult.errors.length, 5)} de{" "}
                        {importResult.errors.length})
                      </p>
                      {importResult.errors.slice(0, 5).map((error) => (
                        <div
                          key={`${error.row}-${error.message}`}
                          className="flex items-start gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-xs"
                        >
                          <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono font-bold text-red-700 flex-shrink-0">
                            L{error.row}
                          </span>
                          <span className="text-zinc-600">{error.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-amber-50 via-white to-rose-50">
            <div>
              <CardTitle>Catálogo de multas</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Cadastre multas com código, título e descrição para reaproveitar
                no financeiro.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSaveFineCatalog}>
              <div className="space-y-3">
                {fineCatalogDraft.map((item, index) => (
                  <div
                    key={`${item.code}-${index}`}
                    className="rounded-lg border border-fleet-line bg-zinc-50/60 p-4"
                  >
                    <div className="grid gap-3 md:grid-cols-[150px_1fr_auto]">
                      <label className="space-y-2 text-sm font-medium">
                        Código
                        <Input
                          value={item.code}
                          onChange={(event) =>
                            setFineCatalogDraft((current) =>
                              current.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? { ...entry, code: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                          placeholder="multa_001"
                        />
                      </label>
                      <label className="space-y-2 text-sm font-medium">
                        Título
                        <Input
                          value={item.title}
                          onChange={(event) =>
                            setFineCatalogDraft((current) =>
                              current.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? { ...entry, title: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                          placeholder="Excesso de velocidade"
                        />
                      </label>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            setFineCatalogDraft((current) =>
                              current.filter(
                                (_entry, entryIndex) => entryIndex !== index,
                              ),
                            )
                          }
                        >
                          <Trash2 size={16} />
                          Remover
                        </Button>
                      </div>
                    </div>
                    <label className="mt-3 block space-y-2 text-sm font-medium">
                      Descrição
                      <Input
                        value={item.description ?? ""}
                        onChange={(event) =>
                          setFineCatalogDraft((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, description: event.target.value }
                                : entry,
                            ),
                          )
                        }
                        placeholder="Detalhe padrão da infração"
                      />
                    </label>
                  </div>
                ))}
              </div>

              {fineCatalogMessage && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  {fineCatalogMessage}
                </p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setFineCatalogDraft((current) => [
                      ...current,
                      { code: "", title: "", description: "" },
                    ])
                  }
                >
                  <Plus size={16} />
                  Nova multa
                </Button>
                <Button
                  type="submit"
                  disabled={saveFineCatalogMutation.isPending}
                >
                  {saveFineCatalogMutation.isPending
                    ? "Salvando..."
                    : "Salvar catálogo de multas"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-violet-50 via-white to-cyan-50">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <button
                type="button"
                onClick={() => setRolesExpanded((current) => !current)}
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
              >
                <span className="mt-1 rounded-full border border-violet-200 bg-white p-2 text-violet-600 shadow-sm">
                  <ChevronRight
                    size={18}
                    className={`transition-transform ${rolesExpanded ? "rotate-90" : ""}`}
                  />
                </span>
                <div className="min-w-0">
                  <CardTitle>Grupos de permissões</CardTitle>
                  <p className="mt-1 text-sm text-zinc-500">
                    Monte grupos personalizados para criar, editar, excluir,
                    exportar e administrar módulos específicos.
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Apenas o grupo Super Admin permanece protegido.
                  </p>
                </div>
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setRolesExpanded((current) => !current)}
                >
                  {rolesExpanded ? "Recolher" : "Abrir"}
                </Button>
                <Button type="button" onClick={openCreateRoleModal}>
                  <ShieldCheck size={18} />
                  Novo grupo
                </Button>
              </div>
            </div>
          </CardHeader>
          {rolesExpanded && (
            <CardContent className="space-y-3">
              {roles.map((role) => (
                <div
                  key={role._id ?? role.key}
                  className="rounded-lg border border-fleet-line bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-fleet-ink">{role.name}</strong>
                        <Badge tone={role.system ? "neutral" : "cyan"}>
                          {role.system ? "Padrão do sistema" : "Customizado"}
                        </Badge>
                        <Badge
                          tone={role.status === "active" ? "green" : "amber"}
                        >
                          {role.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        Chave: <span className="font-mono">{role.key}</span>
                      </p>
                      {role.description && (
                        <p className="mt-1 text-sm text-zinc-600">
                          {role.description}
                        </p>
                      )}
                      {role.system && (
                        <p className="mt-2 text-xs text-amber-700">
                          Grupo protegido do sistema.
                        </p>
                      )}
                    </div>
                    <ActionMenu
                      items={[
                        {
                          label: role.system
                            ? "Grupo padrão não editável"
                            : "Editar",
                          icon: <Edit2 size={15} />,
                          disabled: role.system,
                          onClick: () => openEditRoleModal(role),
                        },
                        {
                          label: role.system
                            ? "Grupo padrão não removível"
                            : "Excluir",
                          icon: <Trash2 size={15} />,
                          danger: true,
                          disabled: role.system || deleteRoleMutation.isPending,
                          onClick: () => {
                            if (
                              role._id &&
                              window.confirm(
                                `Excluir o grupo ${role.name}? Usuários vinculados perderão esse perfil.`,
                              )
                            ) {
                              deleteRoleMutation.mutate(role._id);
                            }
                          },
                        },
                      ]}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {role.permissions.slice(0, 6).map((permission) => (
                      <span
                        key={permission}
                        className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600"
                      >
                        {permission}
                      </span>
                    ))}
                    {role.permissions.length > 6 && (
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600">
                        +{role.permissions.length - 6} permissões
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-amber-50 via-white to-emerald-50">
          <div>
            <CardTitle>Parâmetros de alerta</CardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              Limites usados para alertas operacionais e vencimentos.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form id="settings-form" onSubmit={handleSaveSettings}>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 text-sm font-medium">
                <span className="block text-zinc-700">Velocidade maxima</span>
                <Input
                  className="mt-3 bg-white"
                  name="speedLimit"
                  type="number"
                  min="1"
                  defaultValue="90"
                />
                <span className="mt-2 block text-xs font-normal text-zinc-500">
                  Dispara alerta de excesso de velocidade.
                </span>
              </label>
              <label className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 text-sm font-medium">
                <span className="block text-zinc-700">
                  Dias para vencimento
                </span>
                <Input
                  className="mt-3 bg-white"
                  name="expirationDays"
                  type="number"
                  min="1"
                  defaultValue="30"
                />
                <span className="mt-2 block text-xs font-normal text-zinc-500">
                  Janela para documentos e CNHs próximos do prazo.
                </span>
              </label>
              <label className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 text-sm font-medium">
                <span className="block text-zinc-700">
                  Tempo parado em minutos
                </span>
                <Input
                  className="mt-3 bg-white"
                  name="idleMinutes"
                  type="number"
                  min="1"
                  defaultValue="20"
                />
                <span className="mt-2 block text-xs font-normal text-zinc-500">
                  Base para alertas de ociosidade.
                </span>
              </label>
            </div>
            {message && (
              <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {message}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-cyan-50 via-white to-emerald-50">
          <div>
            <CardTitle>Catálogo de manutenção</CardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              Cadastre centros de custo, serviços e grupos para usar nos selects
              da OS.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSaveMaintenanceCatalog}>
            <div className="grid gap-4 xl:grid-cols-3">
              {[
                {
                  title: "Centros de custo",
                  values: maintenanceCostCentersDraft,
                  setValues: setMaintenanceCostCentersDraft,
                  placeholder: "Oficina Central",
                },
                {
                  title: "Serviços",
                  values: maintenanceServicesDraft,
                  setValues: setMaintenanceServicesDraft,
                  placeholder: "Troca de óleo",
                },
                {
                  title: "Grupos",
                  values: maintenanceGroupsDraft,
                  setValues: setMaintenanceGroupsDraft,
                  placeholder: "Suspensão",
                },
              ].map((section) => (
                <div
                  key={section.title}
                  className="rounded-xl border border-fleet-line bg-zinc-50/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-fleet-ink">
                        {section.title}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        Adicione e remova itens individualmente.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        section.setValues((current: string[]) => [
                          ...current,
                          "",
                        ])
                      }
                    >
                      <Plus size={16} />
                      Adicionar
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {section.values.map((value: string, index: number) => (
                      <div
                        key={`${section.title}-${index}`}
                        className="flex items-end gap-2"
                      >
                        <label className="flex-1 space-y-2 text-sm font-medium">
                          <span className="text-zinc-700">
                            Item {index + 1}
                          </span>
                          <Input
                            value={value}
                            onChange={(event) =>
                              section.setValues((current: string[]) =>
                                current.map(
                                  (entry: string, entryIndex: number) =>
                                    entryIndex === index
                                      ? event.target.value
                                      : entry,
                                ),
                              )
                            }
                            placeholder={section.placeholder}
                          />
                        </label>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            section.setValues((current: string[]) =>
                              current.filter(
                                (_: string, entryIndex: number) =>
                                  entryIndex !== index,
                              ),
                            )
                          }
                        >
                          <Trash2 size={16} />
                          Remover
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {maintenanceCatalogMessage && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {maintenanceCatalogMessage}
              </p>
            )}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={saveMaintenanceCatalogMutation.isPending}
              >
                {saveMaintenanceCatalogMutation.isPending
                  ? "Salvando..."
                  : "Salvar catálogo"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Modal
        open={isUserModalOpen}
        title={editingUser ? "Editar usu?rio" : "Novo usu?rio"}
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
                options={availableRoleOptions}
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
                : "Salvar usuÃ¡rio"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={isRoleModalOpen}
        title={
          editingRole
            ? "Editar grupo de permissões"
            : "Novo grupo de permissões"
        }
        description="Defina o perfil, status e as permissões liberadas para esse grupo."
        onClose={closeRoleModal}
      >
        <form className="space-y-4" onSubmit={handleRoleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Nome do grupo
              <Input
                name="name"
                defaultValue={editingRole?.name ?? ""}
                placeholder="Ex.: Supervisor de abastecimento"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Chave técnica
              <Input
                name="key"
                defaultValue={editingRole?.key ?? ""}
                placeholder="supervisor_abastecimento"
                disabled={Boolean(editingRole?._id)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Descrição
              <Input
                name="description"
                defaultValue={editingRole?.description ?? ""}
                placeholder="Grupo voltado a operação com acesso restrito."
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Status
              <SearchableSelect
                name="status"
                defaultValue={editingRole?.status ?? "active"}
                searchable={false}
                options={[
                  { value: "active", label: "Ativo" },
                  { value: "inactive", label: "Inativo" },
                ]}
              />
            </label>
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Permissões
              <MultiSearchableSelect
                name="permissions"
                defaultValue={editingRole?.permissions ?? []}
                options={permissionOptions}
                placeholder="Selecionar permissões"
                searchPlaceholder="Buscar permissão"
              />
            </label>
          </div>
          {roleError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {roleError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeRoleModal}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                createRoleMutation.isPending || updateRoleMutation.isPending
              }
            >
              {createRoleMutation.isPending || updateRoleMutation.isPending
                ? "Salvando..."
                : "Salvar grupo"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(apiTokenModal)}
        title="Token de API gerado"
        description="Copie e guarde agora. Depois ele não poderá ser visualizado novamente."
        onClose={() => setApiTokenModal(undefined)}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Token gerado para <strong>{apiTokenModal?.userName}</strong>.
          </div>
          <label className="space-y-2 text-sm font-medium">
            Token
            <Input readOnly value={apiTokenModal?.token ?? ""} />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                if (apiTokenModal?.token) {
                  await navigator.clipboard.writeText(apiTokenModal.token);
                  setMessage("Token copiado para a área de transferência.");
                }
              }}
            >
              Copiar token
            </Button>
            <Button type="button" onClick={() => setApiTokenModal(undefined)}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(detailUser)}
        title="Detalhes do usuÃ¡rio"
        description="Dados cadastrais, perfil e acesso Ã  API."
        onClose={() => setDetailUser(undefined)}
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-fleet-line bg-zinc-50/70 p-4">
              <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Nome
              </span>
              <strong className="mt-2 block text-fleet-ink">
                {detailUser?.name ?? "-"}
              </strong>
            </div>
            <div className="rounded-lg border border-fleet-line bg-zinc-50/70 p-4">
              <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Email
              </span>
              <strong className="mt-2 block text-fleet-ink">
                {detailUser?.email ?? "-"}
              </strong>
            </div>
            <div className="rounded-lg border border-fleet-line bg-zinc-50/70 p-4">
              <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Perfil
              </span>
              <strong className="mt-2 block text-fleet-ink">
                {detailUser?.roles
                  ?.map((role) => resolvedRoleLabels[role] ?? role)
                  .join(", ") ?? "-"}
              </strong>
            </div>
            <div className="rounded-lg border border-fleet-line bg-zinc-50/70 p-4">
              <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Status
              </span>
              <div className="mt-2">
                <Badge tone={statusTone[detailUser?.status ?? ""] ?? "neutral"}>
                  {labelFor(detailUser?.status)}
                </Badge>
              </div>
            </div>
            <div className="rounded-lg border border-fleet-line bg-zinc-50/70 p-4">
              <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Filial
              </span>
              <strong className="mt-2 block text-fleet-ink">
                {detailUser?.branchId ?? "Sem filial"}
              </strong>
            </div>
            <div className="rounded-lg border border-fleet-line bg-zinc-50/70 p-4">
              <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Criado em
              </span>
              <strong className="mt-2 block text-fleet-ink">
                {formatDateTime(detailUser?.createdAt)}
              </strong>
            </div>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Acesso à API
                </span>
                <div className="mt-2">
                  <Badge
                    tone={detailUser?.apiAccessEnabled ? "green" : "neutral"}
                  >
                    {detailUser?.apiAccessEnabled
                      ? "Habilitado"
                      : "Desabilitado"}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={enableApiAccessMutation.isPending}
                  onClick={() =>
                    detailUser && enableApiAccessMutation.mutate(detailUser._id)
                  }
                >
                  <KeyRound size={16} />
                  {detailUser?.apiAccessEnabled
                    ? "Regenerar token"
                    : "Gerar token"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    !detailUser?.apiAccessEnabled ||
                    disableApiAccessMutation.isPending
                  }
                  onClick={() => {
                    if (
                      detailUser &&
                      window.confirm(
                        `Revogar o acesso Ã  API do usuÃ¡rio ${detailUser.name}?`,
                      )
                    ) {
                      disableApiAccessMutation.mutate(detailUser._id);
                      setDetailUser(undefined);
                    }
                  }}
                >
                  <X size={16} />
                  Revogar acesso
                </Button>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-white/80 bg-white/80 p-4">
                <span className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <span>Token</span>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={
                      !detailUser?._id || !apiTokensByUser[detailUser._id]
                    }
                    onClick={async () => {
                      const token = detailUser?._id
                        ? apiTokensByUser[detailUser._id]
                        : undefined;
                      if (token) {
                        await navigator.clipboard.writeText(token);
                        setMessage(
                          "Token copiado para a ?rea de transfer?ncia.",
                        );
                      }
                    }}
                  >
                    Copiar token
                  </Button>
                </span>
                <strong className="mt-2 block break-all text-fleet-ink">
                  {detailUser?.apiTokenPreview ?? "Token ainda n?o gerado"}
                </strong>
              </div>
              <div className="rounded-lg border border-white/80 bg-white/80 p-4">
                <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Última geração
                </span>
                <strong className="mt-2 block text-fleet-ink">
                  {formatDateTime(detailUser?.lastApiTokenIssuedAt)}
                </strong>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={() => setDetailUser(undefined)}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
