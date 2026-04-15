import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../store/auth-store';
import type { ApiPage, AuditTrailItem, AuthUser, Dashboard, Driver, FuelRecord, MaintenanceOrder, TrackingSnapshot, Vehicle } from './types';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api/v1',
  timeout: 8000
});

export function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const responseMessage = error.response?.data?.message;
    return Array.isArray(responseMessage) ? responseMessage.join(', ') : responseMessage ?? fallback;
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

export async function login(email: string, password: string) {
  const { data } = await api.post<{ user: AuthUser; accessToken: string; refreshToken: string }>('/auth/login', {
    email,
    password
  });
  return data;
}

export async function getDashboard(filters?: { from?: string; to?: string }) {
  const { data } = await api.get<Dashboard>('/dashboard', {
    params: filters
  });
  return data;
}

export async function getVehiclesPage(params?: { page?: number; limit?: number; search?: string; sortBy?: string; sortDir?: 'asc' | 'desc' }) {
  const { data } = await api.get<ApiPage<Vehicle>>('/vehicles', {
    params: { page: params?.page ?? 1, limit: params?.limit ?? 50, search: params?.search, sortBy: params?.sortBy ?? 'updatedAt', sortDir: params?.sortDir ?? 'desc' }
  });
  return data;
}

export async function getVehicles() {
  const data = await getVehiclesPage();
  return data.data;
}

export async function getDrivers() {
  const { data } = await api.get<ApiPage<Driver>>('/drivers', {
    params: { limit: 50, sortBy: 'score', sortDir: 'desc' }
  });
  return data.data;
}

export async function getTracking() {
  const { data } = await api.get<TrackingSnapshot>('/tracking/live');
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

export async function listResource<T>(path: string) {
  const { data } = await api.get<ApiPage<T>>(path, { params: { limit: 50 } });
  return data.data;
}

export async function listResourcePage<T>(path: string, params?: { page?: number; limit?: number; sortBy?: string; sortDir?: 'asc' | 'desc' }) {
  const { data } = await api.get<ApiPage<T>>(path, {
    params: { page: params?.page ?? 1, limit: params?.limit ?? 20, sortBy: params?.sortBy, sortDir: params?.sortDir }
  });
  return data;
}

export async function getAuditTrail(entityId: string) {
  const { data } = await api.get<AuditTrailItem[]>(`/compliance/audit-logs/entity/${entityId}`);
  return data;
}

export async function createVehicle(payload: Partial<Vehicle>) {
  const { data } = await api.post<Vehicle>('/vehicles', payload);
  return data;
}

export async function updateVehicle(id: string, payload: Partial<Vehicle>) {
  const { data } = await api.patch<Vehicle>(`/vehicles/${id}`, payload);
  return data;
}

export async function deleteVehicle(id: string) {
  const { data } = await api.delete<{ success: boolean; deletedId: string }>(`/vehicles/${id}`);
  return data;
}

export async function createDriver(payload: Partial<Driver>) {
  const { data } = await api.post<Driver>('/drivers', payload);
  return data;
}

export async function updateDriver(id: string, payload: Partial<Driver>) {
  const { data } = await api.patch<Driver>(`/drivers/${id}`, payload);
  return data;
}

export async function deleteDriver(id: string) {
  const { data } = await api.delete<{ success: boolean; deletedId: string }>(`/drivers/${id}`);
  return data;
}

export async function createMaintenanceOrder(payload: Record<string, unknown>) {
  const { data } = await api.post<MaintenanceOrder>('/maintenance/orders', payload);
  return data;
}

export async function updateMaintenanceOrder(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch<MaintenanceOrder>(`/maintenance/orders/${id}`, payload);
  return data;
}

export async function deleteMaintenanceOrder(id: string) {
  const { data } = await api.delete<{ success: boolean; deletedId: string }>(`/maintenance/orders/${id}`);
  return data;
}

export async function createFuelRecord(payload: Record<string, unknown>) {
  const { data } = await api.post<FuelRecord>('/finance/fuel-records', payload);
  return data;
}

export async function updateFuelRecord(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch<FuelRecord>(`/finance/fuel-records/${id}`, payload);
  return data;
}

export async function deleteFuelRecord(id: string) {
  const { data } = await api.delete<{ success: boolean; deletedId: string }>(`/finance/fuel-records/${id}`);
  return data;
}

export async function uploadFuelRecordAttachment(id: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<FuelRecord>(`/finance/fuel-records/${id}/attachments`, formData, {
    timeout: 60_000
  });
  return data;
}

export async function downloadFuelRecordAttachment(id: string, attachment: { fileName: string; originalName: string }) {
  const { data } = await api.get<Blob>(`/finance/fuel-records/${id}/attachments/${encodeURIComponent(attachment.fileName)}`, {
    responseType: 'blob'
  });
  const url = window.URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.originalName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function createDocument(payload: Record<string, unknown>) {
  const { data } = await api.post('/compliance/documents', payload);
  return data;
}

export async function updateDocument(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/compliance/documents/${id}`, payload);
  return data;
}

export async function deleteDocument(id: string) {
  const { data } = await api.delete<{ success: boolean; deletedId: string }>(`/compliance/documents/${id}`);
  return data;
}

export async function createComplianceCheck(payload: Record<string, unknown>) {
  const { data } = await api.post('/compliance/checks', payload);
  return data;
}

export async function updateComplianceCheck(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/compliance/checks/${id}`, payload);
  return data;
}

export async function deleteComplianceCheck(id: string) {
  const { data } = await api.delete<{ success: boolean; deletedId: string }>(`/compliance/checks/${id}`);
  return data;
}

export async function saveSetting(key: string, value: number | string | boolean) {
  const { data } = await api.post('/settings/parameters', {
    scope: 'tenant',
    key,
    value
  });
  return data;
}

export async function uploadLegacySpreadsheet(resource: string, file: File) {
  const formData = new FormData();
  formData.append('resource', resource);
  formData.append('file', file);

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
    }>('/imports/spreadsheet', formData, {
      timeout: 60_000
    });
    return data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Nao foi possivel importar a planilha.'));
  }
}
