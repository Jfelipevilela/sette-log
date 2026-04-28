export type ApiPage<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary?: FuelRecordsSummary;
};

export type AuthUser = {
  _id?: string;
  sub?: string;
  name: string;
  email: string;
  tenantId: string;
  branchId?: string;
  roles: string[];
  permissions: string[];
};

export type SystemUser = {
  _id: string;
  name: string;
  email: string;
  tenantId: string;
  branchId?: string;
  roles: string[];
  permissions: string[];
  status: 'active' | 'inactive' | 'blocked';
  apiAccessEnabled?: boolean;
  apiTokenPreview?: string;
  lastApiTokenIssuedAt?: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PermissionGroup = {
  _id?: string;
  key: string;
  name: string;
  description?: string;
  permissions: string[];
  status: "active" | "inactive";
  system?: boolean;
};

export type Vehicle = {
  _id: string;
  plate: string;
  brand: string;
  model: string;
  nickname?: string;
  vehicleNumber?: string;
  year?: number;
  type: string;
  status: string;
  odometerKm: number;
  currentOdometerKm?: number;
  initialOdometerKm?: number;
  tankCapacityLiters?: number;
  acceptedFuelTypes?: string[];
  costCenter?: string;
  sector?: string;
  city?: string;
  primaryDriverId?: string;
  lastPosition?: {
    type: "Point";
    coordinates: [number, number];
    address?: string;
  };
  telemetrySummary?: Record<string, number | string | boolean>;
  financialSummary?: Record<string, number>;
};

export type Driver = {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  licenseNumber: string;
  licenseCategory: string;
  licenseExpiresAt: string;
  status: string;
  score: number;
  assignedVehicleId?: string;
  attachments?: string[];
};

export type Alert = {
  _id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  status: string;
  triggeredAt: string;
  vehicleId?: string;
  driverId?: string;
  payload?: Record<string, unknown>;
};

export type AuditTrailItem = {
  _id: string;
  actorUserId?: string;
  actorName?: string;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  method: string;
  path: string;
  status: string;
  createdAt: string;
};

export type MaintenanceOrder = {
  _id: string;
  vehicleId: string;
  driverId?: string;
  type: string;
  priority: string;
  status: string;
  scheduledAt?: string;
  odometerKm?: number;
  totalCost: number;
  attachments?: string[];
  description?: string;
  observations?: string;
  expectedDeliveryAt?: string;
  completionDescription?: string;
  laborCost?: number;
  partsCost?: number;
  items?: Array<{
    name: string;
    category?: string;
    costCenter?: string;
    quantity?: number;
    unitCost?: number;
    totalCost?: number;
  }>;
};

export type FuelRecord = {
  _id: string;
  vehicleId: string;
  driverId?: string;
  liters: number;
  totalCost: number;
  pricePerLiter?: number;
  odometerKm?: number;
  distanceKm?: number;
  kmPerLiter?: number;
  filledAt: string;
  station?: string;
  fuelType: string;
  attachments?: Array<{
    originalName: string;
    fileName: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
    category?: string;
  }>;
};

export type FuelRecordsSummary = {
  count: number;
  liters: number;
  totalCost: number;
  distanceKm: number;
  efficiencyLiters: number;
  averagePrice: number;
  averageKmPerLiter: number;
};

export type DocumentRecord = {
  _id: string;
  entityType: string;
  entityId: string;
  type: string;
  number?: string;
  issuedAt?: string;
  expiresAt?: string;
  fileUrl?: string;
  status: string;
};

export type AppNotification = {
  _id: string;
  title: string;
  message: string;
  status: string;
  createdAt: string;
  readAt?: string;
};

export type DashboardDay = {
  _id: { year: number; month: number; day: number };
  total: number;
  liters: number;
  fuelCost?: number;
  maintenanceCost?: number;
  expenseCost?: number;
};

export type Dashboard = {
  costByDay?: DashboardDay[];

  kpis: {
    totalVehicles: number;
    availableVehicles: number;
    activeDrivers: number;
    openAlerts: number;
    availability: number;
    totalFuelCost: number;
    totalFuelLiters: number;
    totalMaintenanceCost: number;
    totalExpenseCost: number;
    totalOperationalCost: number;
    averageFuelCost: number;
  };
  vehiclesByStatus: Array<{ _id: string; count: number }>;
  criticalVehicles: Vehicle[];
  upcomingMaintenance: MaintenanceOrder[];
  expiringDocuments: DocumentRecord[];
  costByMonth: Array<{
    _id: { year: number; month: number };
    total: number;
    liters: number;
    fuelCost?: number;
    maintenanceCost?: number;
    expenseCost?: number;
  }>;
  fuelByVehicle: Array<{
    vehicleId: string;
    plate: string;
    label: string;
    nickname?: string;
    brand?: string;
    model?: string;
    type?: string;
    tankCapacityLiters?: number;
    totalCost: number;
    totalLiters: number;
    distanceKm?: number;
    efficiencyLiters?: number;
    records: number;
    averagePrice: number;
    averageKmPerLiter?: number;
    lastFuelAt?: string;
  }>;
  topFuelCostVehicles: Array<{
    vehicleId: string;
    plate: string;
    label: string;
    type?: string;
    totalCost: number;
    totalLiters: number;
    distanceKm?: number;
    efficiencyLiters?: number;
    records: number;
    averagePrice: number;
    averageKmPerLiter?: number;
    lastFuelAt?: string;
  }>;
  fuelByType?: Array<{
    fuelType: string;
    totalCost: number;
    totalLiters: number;
    records: number;
  }>;
  dashboardPeriod: {
    from: string;
    to: string;
  };
  recentAlerts: Alert[];
  generatedAt: string;
};

export type DashboardFuelSeriesPoint = {
  label: string;
  year: number;
  month?: number;
  day?: number;
  totalCost: number;
  liters: number;
  records: number;
};

export type DashboardFuelSeries = {
  granularity: "day" | "month" | "year";
  vehicleId?: string;
  period: {
    from: string;
    to: string;
  };
  points: DashboardFuelSeriesPoint[];
};

export type TrackingSnapshot = {
  vehicles: Vehicle[];
  geofences: Array<{
    _id: string;
    name: string;
    type: string;
    center?: { coordinates: [number, number] };
    radiusMeters?: number;
  }>;
  refreshedAt: string;
};
