import axios, { AxiosError } from "axios";
import { useAuthStore } from "../store/auth-store";
import type {
  ApiPage,
  AuditTrailItem,
  AuthUser,
  Dashboard,
  Driver,
  FuelRecordsSummary,
  FuelRecord,
  MaintenanceOrder,
  AppNotification,
  SystemUser,
  TrackingSnapshot,
  Vehicle,
} from "./types";
import { notify } from "./toast";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3333/api/v1",
  timeout: 8000,
});

let sessionExpiredHandled = false;

export function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const responseMessage = error.response?.data?.message;
    return Array.isArray(responseMessage)
      ? responseMessage.join(", ")
      : (responseMessage ?? fallback);
  }
  return error instanceof Error ? error.message : fallback;
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function successMessage(method?: string, url?: string) {
  const normalizedUrl = url ?? "";
  const normalizedMethod = method?.toUpperCase();
  if (!normalizedMethod || normalizedMethod === "GET") {
    return undefined;
  }
  if (normalizedUrl.includes("/auth/")) {
    return undefined;
  }
  if (normalizedUrl.includes("/imports/spreadsheet")) {
    return "Importação processada";
  }
  if (normalizedUrl.includes("/attachments")) {
    return "Arquivo anexado";
  }
  if (normalizedMethod === "POST") {
    return "Cadastro realizado";
  }
  if (normalizedMethod === "PATCH" || normalizedMethod === "PUT") {
    return "Registro atualizado";
  }
  if (normalizedMethod === "DELETE") {
    return "Registro excluido";
  }
  return "Acao realizada";
}

api.interceptors.response.use(
  (response) => {
    const message = successMessage(response.config.method, response.config.url);
    if (message) {
      notify({
        title: message,
        description: "Os dados foram salvos no sistema.",
        tone: "success",
      });
    }
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url ?? "");
    const isAuthRequest = url.includes("/auth/");
    if (status === 401 && !isAuthRequest && !sessionExpiredHandled) {
      sessionExpiredHandled = true;
      useAuthStore.getState().logout();
      notify({
        title: "Sessão expirada",
        description: "Entre novamente para continuar usando o sistema.",
        tone: "info",
      });
      if (window.location.pathname !== "/login") {
        window.history.replaceState(null, "", "/login");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
      return Promise.reject(error);
    }

    const method = error?.config?.method?.toUpperCase?.();
    if (method && method !== "GET") {
      notify({
        title: "Não foi possível concluir a ação",
        description: apiErrorMessage(error, "Verifique os dados e tente novamente."),
        tone: "error",
      });
    }
    return Promise.reject(error);
  },
);

export async function login(email: string, password: string) {
  const { data } = await api.post<{
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }>("/auth/login", {
    email,
    password,
  });
  sessionExpiredHandled = false;
  return data;
}

export async function getDashboard(filters?: { from?: string; to?: string }) {
  const { data } = await api.get<Dashboard>("/dashboard", {
    params: filters,
  });
  return data;
}

export async function getVehiclesPage(params?: {
  page?: number;
  limit?: number;
  search?: string;
  filters?: Record<string, string | number | boolean | undefined>;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const { data } = await api.get<ApiPage<Vehicle>>("/vehicles", {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 50,
      search: params?.search,
      filters: params?.filters ? JSON.stringify(params.filters) : undefined,
      sortBy: params?.sortBy ?? "updatedAt",
      sortDir: params?.sortDir ?? "desc",
    },
  });
  return data;
}

export async function getVehicles() {
  const data = await getVehiclesPage();
  return data.data;
}

export async function getDrivers() {
  const { data } = await api.get<ApiPage<Driver>>("/drivers", {
    params: { limit: 50, sortBy: "score", sortDir: "desc" },
  });
  return data.data;
}

export async function getNotifications() {
  const { data } = await api.get<ApiPage<AppNotification>>("/notifications", {
    params: { limit: 10, sortBy: "createdAt", sortDir: "desc" },
  });
  return data.data;
}

export async function markNotificationRead(id: string) {
  const { data } = await api.post<AppNotification>(`/notifications/${id}/read`);
  return data;
}

export async function getUsersPage(params?: {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const { data } = await api.get<ApiPage<SystemUser>>("/users", {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      search: params?.search,
      sortBy: params?.sortBy ?? "createdAt",
      sortDir: params?.sortDir ?? "desc",
    },
  });
  return data;
}

export async function createUser(payload: Record<string, unknown>) {
  const { data } = await api.post<SystemUser>("/users", payload);
  return data;
}

export async function updateUser(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch<SystemUser>(`/users/${id}`, payload);
  return data;
}

export async function deleteUser(id: string) {
  const { data } = await api.delete<{ success: boolean; deletedId: string }>(
    `/users/${id}`,
  );
  return data;
}

export async function enableUserApiAccess(id: string) {
  const { data } = await api.post<{ user: SystemUser; apiToken: string }>(
    `/users/${id}/api-access`,
  );
  return data;
}

export async function disableUserApiAccess(id: string) {
  const { data } = await api.delete<SystemUser>(`/users/${id}/api-access`);
  return data;
}

export async function getTracking() {
  const { data } = await api.get<TrackingSnapshot>("/tracking/live");
  return data;
}

export async function getRoutePlayback(vehicleId: string) {
  const { data } = await api.get<
    Array<{
      _id: string;
      occurredAt: string;
      location: { coordinates: [number, number] };
      speedKph?: number;
    }>
  >(`/tracking/vehicles/${vehicleId}/playback`);
  return data;
}

export async function downloadResourceExport(resource: string) {
  try {
    const response = await api.get(`/exports/${resource}`, {
      responseType: "blob",
      timeout: 60_000,
    });
    const url = window.URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `${resource}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error(apiErrorMessage(error, "Não foi possível exportar CSV."));
  }
}

export async function listResource<T>(path: string) {
  const { data } = await api.get<ApiPage<T>>(path, { params: { limit: 50 } });
  return data.data;
}

export async function listResourcePage<T>(
  path: string,
  params?: {
    page?: number;
    limit?: number;
    search?: string;
    filters?: Record<string, string | number | boolean | undefined>;
    sortBy?: string;
    sortDir?: "asc" | "desc";
  },
) {
  const { data } = await api.get<ApiPage<T>>(path, {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      search: params?.search,
      filters: params?.filters ? JSON.stringify(params.filters) : undefined,
      sortBy: params?.sortBy,
      sortDir: params?.sortDir,
    },
  });
  return data;
}

export async function listAllResourcePages<T>(
  path: string,
  params?: {
    search?: string;
    filters?: Record<string, string | number | boolean | undefined>;
    sortBy?: string;
    sortDir?: "asc" | "desc";
  },
) {
  const limit = 100;
  const firstPage = await listResourcePage<T>(path, {
    page: 1,
    limit,
    search: params?.search,
    filters: params?.filters,
    sortBy: params?.sortBy,
    sortDir: params?.sortDir,
  });
  const allItems = [...firstPage.data];

  for (let page = 2; page <= firstPage.meta.totalPages; page += 1) {
    const nextPage = await listResourcePage<T>(path, {
      page,
      limit,
      search: params?.search,
      filters: params?.filters,
      sortBy: params?.sortBy,
      sortDir: params?.sortDir,
    });
    allItems.push(...nextPage.data);
  }

  return allItems;
}

export async function getAuditTrail(entityId: string) {
  const { data } = await api.get<AuditTrailItem[]>(
    `/compliance/audit-logs/entity/${entityId}`,
  );
  return data;
}

export async function createVehicle(payload: Partial<Vehicle>) {
  const { data } = await api.post<Vehicle>("/vehicles", payload);
  return data;
}

export async function updateVehicle(id: string, payload: Partial<Vehicle>) {
  const { data } = await api.patch<Vehicle>(`/vehicles/${id}`, payload);
  return data;
}

export async function deleteVehicle(id: string) {
  const { data } = await api.delete<{ success: boolean; deletedId: string }>(
    `/vehicles/${id}`,
  );
  return data;
}

export async function createDriver(payload: Partial<Driver>) {
  const { data } = await api.post<Driver>("/drivers", payload);
  return data;
}

export async function updateDriver(id: string, payload: Partial<Driver>) {
  const { data } = await api.patch<Driver>(`/drivers/${id}`, payload);
  return data;
}

export async function deleteDriver(id: string) {
  const { data } = await api.delete<{ success: boolean; deletedId: string }>(
    `/drivers/${id}`,
  );
  return data;
}

export async function createMaintenanceOrder(payload: Record<string, unknown>) {
  const { data } = await api.post<MaintenanceOrder>(
    "/maintenance/orders",
    payload,
  );
  return data;
}

export async function updateMaintenanceOrder(
  id: string,
  payload: Record<string, unknown>,
) {
  const { data } = await api.patch<MaintenanceOrder>(
    `/maintenance/orders/${id}`,
    payload,
  );
  return data;
}

export async function deleteMaintenanceOrder(id: string) {
  const { data } = await api.delete<{ success: boolean; deletedId: string }>(
    `/maintenance/orders/${id}`,
  );
  return data;
}

export async function createFuelRecord(payload: Record<string, unknown>) {
  const { data } = await api.post<FuelRecord>("/finance/fuel-records", payload);
  return data;
}

export async function updateFuelRecord(
  id: string,
  payload: Record<string, unknown>,
) {
  const { data } = await api.patch<FuelRecord>(
    `/finance/fuel-records/${id}`,
    payload,
  );
  return data;
}

export async function deleteFuelRecord(id: string) {
  const { data } = await api.delete<{ success: boolean; deletedId: string }>(
    `/finance/fuel-records/${id}`,
  );
  return data;
}

export async function uploadFuelRecordAttachment(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<FuelRecord>(
    `/finance/fuel-records/${id}/attachments`,
    formData,
    {
      timeout: 60_000,
    },
  );
  return data;
}

export async function downloadFuelRecordAttachment(
  id: string,
  attachment: { fileName: string; originalName: string },
) {
  const data = await fetchFuelRecordAttachmentBlob(id, attachment.fileName);
  const url = window.URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.originalName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function fetchFuelRecordAttachmentBlob(
  id: string,
  fileName: string,
) {
  const { data } = await api.get<Blob>(
    `/finance/fuel-records/${id}/attachments/${encodeURIComponent(fileName)}`,
    {
      responseType: "blob",
    },
  );
  return data;
}

export function downloadExternalFile(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.target = "_blank";
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function createDocument(payload: Record<string, unknown>) {
  const { data } = await api.post("/compliance/documents", payload);
  return data;
}

export async function updateDocument(
  id: string,
  payload: Record<string, unknown>,
) {
  const { data } = await api.patch(`/compliance/documents/${id}`, payload);
  return data;
}

export async function deleteDocument(id: string) {
  const { data } = await api.delete<{ success: boolean; deletedId: string }>(
    `/compliance/documents/${id}`,
  );
  return data;
}

export async function createComplianceCheck(payload: Record<string, unknown>) {
  const { data } = await api.post("/compliance/checks", payload);
  return data;
}

export async function uploadComplianceCheckAttachments(
  id: string,
  files: File[],
) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const { data } = await api.post(
    `/compliance/checks/${id}/attachments`,
    formData,
    {
      timeout: 60_000,
    },
  );
  return data;
}

export async function fetchComplianceCheckAttachmentBlob(
  id: string,
  fileName: string,
) {
  const { data } = await api.get<Blob>(
    `/compliance/checks/${id}/attachments/${encodeURIComponent(fileName)}`,
    {
      responseType: "blob",
    },
  );
  return data;
}

export async function downloadComplianceCheckAttachment(
  id: string,
  attachment: { fileName: string; originalName: string },
) {
  const data = await fetchComplianceCheckAttachmentBlob(
    id,
    attachment.fileName,
  );
  const url = window.URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.originalName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function updateComplianceCheck(
  id: string,
  payload: Record<string, unknown>,
) {
  const { data } = await api.patch(`/compliance/checks/${id}`, payload);
  return data;
}

export async function deleteComplianceCheck(id: string) {
  const { data } = await api.delete<{ success: boolean; deletedId: string }>(
    `/compliance/checks/${id}`,
  );
  return data;
}

export async function saveSetting(
  key: string,
  value: number | string | boolean,
) {
  const { data } = await api.post("/settings/parameters", {
    scope: "tenant",
    key,
    value,
  });
  return data;
}

export async function uploadLegacySpreadsheet(
  resource: string,
  file: File,
  options?: { recalculateFuelTotal?: boolean },
) {
  const formData = new FormData();
  formData.append("resource", resource);
  formData.append("file", file);
  if (options?.recalculateFuelTotal) {
    formData.append("recalculateFuelTotal", "true");
  }

  try {
    const { data } = await api.post<{
      resource: string;
      fileName: string;
      totalRows: number;
      imported: number;
      updated: number;
      failed: number;
      errors: Array<{ row: number; message: string }>;
      sampleColumns: string[];
    }>("/imports/spreadsheet", formData, {
      timeout: 60_000,
    });
    return data;
  } catch (error) {
    throw new Error(
      apiErrorMessage(error, "Não foi possível importar a planilha."),
    );
  }
}

export async function downloadImportTemplate() {
  try {
    const response = await fetch(
      `/templates/sette-log-importação-template.xlsx?v=${Date.now()}`,
    );
    if (!response.ok) {
      throw new Error("Template não encontrado.");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "sette-log-importação-template.xlsx");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error(
      apiErrorMessage(error, "Não foi possível baixar o template."),
    );
  }
}

export async function uploadCompleteLegacySpreadsheet(
  file: File,
  options?: { recalculateFuelTotal?: boolean },
) {
  const formData = new FormData();
  formData.append("file", file);
  if (options?.recalculateFuelTotal) {
    formData.append("recalculateFuelTotal", "true");
  }

  try {
    const { data } = await api.post<{
      fileName: string;
      totalResources: number;
      results: Array<{
        resource: string;
        fileName: string;
        totalRows: number;
        imported: number;
        updated: number;
        failed: number;
        errors: Array<{ row: number; message: string }>;
      }>;
      summary: {
        totalImported: number;
        totalUpdated: number;
        totalFailed: number;
      };
    }>("/imports/spreadsheet/complete", formData, {
      timeout: 120_000,
    });
    return data;
  } catch (error) {
    throw new Error(
      apiErrorMessage(error, "Não foi possível importar a planilha completa."),
    );
  }
}
