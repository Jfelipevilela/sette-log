import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CreditCard,
  Download,
  Edit2,
  Filter,
  Fuel,
  Plus,
  Receipt,
  Search,
  Shield,
  TrendingUp,
  TriangleAlert,
  Trash2,
  Wrench,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ActionMenu } from "../../components/ui/action-menu";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { FilterPanel } from "../../components/ui/filter-panel";
import { Input } from "../../components/ui/input";
import { Modal } from "../../components/ui/modal";
import { SearchableSelect } from "../../components/ui/searchable-select";
import { StatCard } from "../../components/ui/stat-card";
import { Table, Td, Th } from "../../components/ui/table";
import {
  apiErrorMessage,
  createExpense,
  createFine,
  createIncident,
  createInsurance,
  deleteFinanceResource,
  downloadResourceExport,
  getDrivers,
  getVehicles,
  listAllResourcePages,
  updateFinanceResource,
} from "../../lib/api";
import type { MaintenanceOrder, Vehicle } from "../../lib/types";
import { formatCurrency, formatDate } from "../../lib/utils";

type ExpenseType = "expense" | "fine" | "incident" | "insurance";

type ExpenseRecord = {
  _id: string;
  vehicleId?: string;
  driverId?: string;
  category: string;
  subcategory?: string;
  description: string;
  amount: number;
  occurredAt: string;
  costCenter?: string;
  vendor?: string;
  documentNumber?: string;
};

type FineRecord = {
  _id: string;
  vehicleId?: string;
  driverId?: string;
  amount?: number;
  occurredAt?: string;
  dueAt?: string;
  status?: string;
  infractionCode?: string;
};

type IncidentRecord = {
  _id: string;
  vehicleId?: string;
  driverId?: string;
  amount?: number;
  occurredAt?: string;
  severity?: string;
  description?: string;
  status?: string;
};

type InsuranceRecord = {
  _id: string;
  vehicleId?: string;
  provider?: string;
  policyNumber?: string;
  startsAt?: string;
  expiresAt?: string;
  premiumAmount?: number;
  status?: string;
};

type FuelRecordLite = {
  _id: string;
  vehicleId: string;
  liters: number;
  totalCost: number;
  odometerKm?: number;
  filledAt: string;
};

type DriverLite = {
  _id: string;
  name: string;
  email?: string;
  licenseNumber: string;
};

type VehicleFinanceSummary = {
  vehicle: Vehicle;
  fuelCost: number;
  fuelLiters: number;
  maintenanceCost: number;
  expenseCost: number;
  fineCost: number;
  incidentCost: number;
  insuranceCost: number;
  totalOperationalCost: number;
  distanceDrivenKm: number;
  efficiencyDistanceKm: number;
  efficiencyLiters: number;
  averageKmPerLiter: number;
  costPerKm: number;
};

type RecentEntry = {
  id: string;
  type: string;
  resource: "expenses" | "fines" | "incidents" | "insurances";
  icon: typeof Receipt;
  vehicleId?: string;
  driverId?: string;
  date?: string;
  description: string;
  status: string;
  amount: number;
  raw: Record<string, unknown>;
};

const pieColors = [
  "#0f8f63",
  "#0ea5e9",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
];

const expenseTypeOptions = [
  { value: "expense", label: "Despesa geral" },
  { value: "fine", label: "Multa" },
  { value: "incident", label: "Sinistro" },
  { value: "insurance", label: "Seguro" },
];

const expenseCategoryOptions = [
  { value: "maintenance", label: "Manutenção" },
  { value: "documentation", label: "Documentação" },
  { value: "toll", label: "Pedágio" },
  { value: "tax", label: "Impostos" },
  { value: "insurance", label: "Seguro" },
  { value: "fine", label: "Multa" },
  { value: "incident", label: "Sinistro" },
  { value: "other", label: "Outros" },
];

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMetric(value: number, unit: string) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${unit}`;
}

function labelForExpenseCategory(value?: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  const labelMap: Record<string, string> = {
    maintenance: "Manutenção",
    manutencao: "Manutenção",
    documentation: "Documentação",
    documentacao: "Documentação",
    toll: "Pedágio",
    pedagio: "Pedágio",
    tax: "Impostos",
    impostos: "Impostos",
    ipva: "Impostos",
    licenciamento: "Impostos",
    insurance: "Seguro",
    seguro: "Seguro",
    fine: "Multa",
    multa: "Multa",
    incident: "Sinistro",
    sinistro: "Sinistro",
    other: "Outros",
    outros: "Outros",
  };
  return labelMap[normalized] ?? (value || "Outros");
}

export function FinancePage() {
  const queryClient = useQueryClient();
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [entryType, setEntryType] = useState<ExpenseType>("expense");
  const [editingEntry, setEditingEntry] = useState<RecentEntry | null>(null);
  const [formError, setFormError] = useState<string>();
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    costCenter: "",
    sector: "",
    city: "",
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles(),
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => getDrivers() as Promise<DriverLite[]>,
  });
  const { data: fuelRecords = [] } = useQuery({
    queryKey: ["finance-fuel-records-all"],
    queryFn: () =>
      listAllResourcePages<FuelRecordLite>("/finance/fuel-records", {
        sortBy: "filledAt",
        sortDir: "asc",
      }),
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["finance-expenses-all"],
    queryFn: () => listAllResourcePages<ExpenseRecord>("/finance/expenses"),
  });
  const { data: maintenanceOrders = [] } = useQuery({
    queryKey: ["finance-maintenance-all"],
    queryFn: () =>
      listAllResourcePages<MaintenanceOrder>("/maintenance/orders", {
        sortBy: "scheduledAt",
        sortDir: "desc",
      }),
  });
  const { data: fines = [] } = useQuery({
    queryKey: ["finance-fines-all"],
    queryFn: () => listAllResourcePages<FineRecord>("/finance/fines"),
  });
  const { data: incidents = [] } = useQuery({
    queryKey: ["finance-incidents-all"],
    queryFn: () => listAllResourcePages<IncidentRecord>("/finance/incidents"),
  });
  const { data: insurances = [] } = useQuery({
    queryKey: ["finance-insurances-all"],
    queryFn: () => listAllResourcePages<InsuranceRecord>("/finance/insurances"),
  });

  const createEntryMutation = useMutation({
    mutationFn: async ({
      type,
      payload,
    }: {
      type: ExpenseType;
      payload: Record<string, unknown>;
    }) => {
      if (type === "fine") {
        return createFine(payload);
      }
      if (type === "incident") {
        return createIncident(payload);
      }
      if (type === "insurance") {
        return createInsurance(payload);
      }
      return createExpense(payload);
    },
    onSuccess: async () => {
      setIsEntryModalOpen(false);
      setFormError(undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance-expenses-all"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-fines-all"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-incidents-all"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-insurances-all"] }),
        queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
      ]);
    },
    onError: (error) =>
      setFormError(
        apiErrorMessage(
          error,
          "Não foi possível salvar o lançamento financeiro.",
        ),
      ),
  });
  const updateEntryMutation = useMutation({
    mutationFn: async ({
      resource,
      id,
      payload,
    }: {
      resource: "expenses" | "fines" | "incidents" | "insurances";
      id: string;
      payload: Record<string, unknown>;
    }) => updateFinanceResource(resource, id, payload),
    onSuccess: async () => {
      setIsEntryModalOpen(false);
      setEditingEntry(null);
      setFormError(undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance-expenses-all"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-fines-all"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-incidents-all"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-insurances-all"] }),
        queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
      ]);
    },
    onError: (error) =>
      setFormError(
        apiErrorMessage(error, "Não foi possível atualizar o lançamento."),
      ),
  });
  const deleteEntryMutation = useMutation({
    mutationFn: ({
      resource,
      id,
    }: {
      resource: "expenses" | "fines" | "incidents" | "insurances";
      id: string;
    }) => deleteFinanceResource(resource, id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance-expenses-all"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-fines-all"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-incidents-all"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-insurances-all"] }),
        queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
      ]);
    },
  });

  const filteredVehicles = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return vehicles.filter(
      (vehicle) =>
        (!term ||
          `${vehicle.plate} ${vehicle.nickname ?? ""} ${vehicle.brand} ${vehicle.model}`
            .toLowerCase()
            .includes(term)) &&
        (!filters.status || vehicle.status === filters.status) &&
        (!filters.costCenter ||
          String(vehicle.costCenter ?? "")
            .toLowerCase()
            .includes(filters.costCenter.toLowerCase())) &&
        (!filters.sector ||
          String(vehicle.sector ?? "")
            .toLowerCase()
            .includes(filters.sector.toLowerCase())) &&
        (!filters.city ||
          String(vehicle.city ?? "")
            .toLowerCase()
            .includes(filters.city.toLowerCase())),
    );
  }, [filters, vehicles]);

  const vehicleOptions = vehicles.map((vehicle) => ({
    value: vehicle._id,
    label: `${vehicle.plate} - ${vehicle.nickname ?? vehicle.model}`,
    searchText: `${vehicle.plate} ${vehicle.nickname ?? ""} ${vehicle.brand} ${vehicle.model}`,
  }));

  const driverOptions = drivers.map((driver) => ({
    value: driver._id,
    label: `${driver.name} - ${driver.licenseNumber}`,
    searchText: `${driver.name} ${driver.licenseNumber} ${driver.email ?? ""}`,
  }));

  const vehicleIdSet = new Set(filteredVehicles.map((vehicle) => vehicle._id));

  const vehicleSummaries = useMemo<VehicleFinanceSummary[]>(() => {
    return filteredVehicles.map((vehicle) => {
      const vehicleFuelRecords = fuelRecords
        .filter((record) => record.vehicleId === vehicle._id)
        .sort(
          (a, b) =>
            new Date(a.filledAt).getTime() - new Date(b.filledAt).getTime(),
        );
      const vehicleExpenses = expenses.filter(
        (record) => record.vehicleId === vehicle._id,
      );
      const vehicleMaintenanceOrders = maintenanceOrders.filter(
        (order) =>
          order.vehicleId === vehicle._id && order.status !== "cancelled",
      );
      const vehicleFines = fines.filter((record) => record.vehicleId === vehicle._id);
      const vehicleIncidents = incidents.filter(
        (record) => record.vehicleId === vehicle._id,
      );
      const vehicleInsurances = insurances.filter(
        (record) => record.vehicleId === vehicle._id,
      );

      const fuelCost = vehicleFuelRecords.reduce(
        (total, record) => total + toNumber(record.totalCost),
        0,
      );
      const fuelLiters = vehicleFuelRecords.reduce(
        (total, record) => total + toNumber(record.liters),
        0,
      );
      const maintenanceCost = vehicleMaintenanceOrders.reduce(
        (total, order) => total + toNumber(order.totalCost),
        0,
      );
      const expenseCost = vehicleExpenses.reduce(
        (total, record) => total + toNumber(record.amount),
        0,
      );
      const fineCost = vehicleFines.reduce(
        (total, record) => total + toNumber(record.amount),
        0,
      );
      const incidentCost = vehicleIncidents.reduce(
        (total, record) => total + toNumber(record.amount),
        0,
      );
      const insuranceCost = vehicleInsurances.reduce(
        (total, record) => total + toNumber(record.premiumAmount),
        0,
      );

      const initialOdometerKm = toNumber(vehicle.initialOdometerKm);
      const currentOdometerKm = Math.max(
        toNumber(vehicle.odometerKm),
        vehicleFuelRecords.reduce(
          (maxValue, record) => Math.max(maxValue, toNumber(record.odometerKm)),
          0,
        ),
      );
      const distanceDrivenKm = Math.max(currentOdometerKm - initialOdometerKm, 0);

      let previousOdometer = initialOdometerKm;
      let efficiencyDistanceKm = 0;
      let efficiencyLiters = 0;

      for (const record of vehicleFuelRecords) {
        const odometerKm = toNumber(record.odometerKm);
        const liters = toNumber(record.liters);
        if (odometerKm > previousOdometer && liters > 0) {
          efficiencyDistanceKm += odometerKm - previousOdometer;
          efficiencyLiters += liters;
          previousOdometer = odometerKm;
          continue;
        }
        if (odometerKm > previousOdometer) {
          previousOdometer = odometerKm;
        }
      }

      const totalOperationalCost =
        fuelCost +
        maintenanceCost +
        expenseCost +
        fineCost +
        incidentCost +
        insuranceCost;

      return {
        vehicle,
        fuelCost,
        fuelLiters,
        maintenanceCost,
        expenseCost,
        fineCost,
        incidentCost,
        insuranceCost,
        totalOperationalCost,
        distanceDrivenKm,
        efficiencyDistanceKm,
        efficiencyLiters,
        averageKmPerLiter:
          efficiencyLiters > 0 ? efficiencyDistanceKm / efficiencyLiters : 0,
        costPerKm:
          distanceDrivenKm > 0 ? totalOperationalCost / distanceDrivenKm : 0,
      };
    });
  }, [expenses, filteredVehicles, fines, fuelRecords, incidents, insurances, maintenanceOrders]);

  const financeOverview = useMemo(() => {
    const totalFuelCost = vehicleSummaries.reduce((sum, item) => sum + item.fuelCost, 0);
    const totalMaintenanceCost = vehicleSummaries.reduce(
      (sum, item) => sum + item.maintenanceCost,
      0,
    );
    const totalExpenseCost = vehicleSummaries.reduce(
      (sum, item) => sum + item.expenseCost,
      0,
    );
    const totalFines = vehicleSummaries.reduce((sum, item) => sum + item.fineCost, 0);
    const totalIncidents = vehicleSummaries.reduce(
      (sum, item) => sum + item.incidentCost,
      0,
    );
    const totalInsuranceCost = vehicleSummaries.reduce(
      (sum, item) => sum + item.insuranceCost,
      0,
    );
    const totalFuelLiters = vehicleSummaries.reduce(
      (sum, item) => sum + item.fuelLiters,
      0,
    );
    const totalOperationalCost = vehicleSummaries.reduce(
      (sum, item) => sum + item.totalOperationalCost,
      0,
    );
    const totalDistanceDrivenKm = vehicleSummaries.reduce(
      (sum, item) => sum + item.distanceDrivenKm,
      0,
    );
    const totalEfficiencyDistanceKm = vehicleSummaries.reduce(
      (sum, item) => sum + item.efficiencyDistanceKm,
      0,
    );
    const totalEfficiencyLiters = vehicleSummaries.reduce(
      (sum, item) => sum + item.efficiencyLiters,
      0,
    );

    return {
      totalFuelCost,
      totalMaintenanceCost,
      totalExpenseCost,
      totalFines,
      totalIncidents,
      totalInsuranceCost,
      totalFuelLiters,
      totalOperationalCost,
      averageKmPerLiter:
        totalEfficiencyLiters > 0
          ? totalEfficiencyDistanceKm / totalEfficiencyLiters
          : 0,
      averageCostPerKm:
        totalDistanceDrivenKm > 0
          ? totalOperationalCost / totalDistanceDrivenKm
          : 0,
      averageCostPerVehicle:
        vehicleSummaries.length > 0
          ? totalOperationalCost / vehicleSummaries.length
          : 0,
      totalDistanceDrivenKm,
      totalEfficiencyDistanceKm,
    };
  }, [vehicleSummaries]);

  const pieData = [
    { name: "Combustível", value: financeOverview.totalFuelCost },
    { name: "Manutenção", value: financeOverview.totalMaintenanceCost },
    { name: "Despesas gerais", value: financeOverview.totalExpenseCost },
    { name: "Multas", value: financeOverview.totalFines },
    { name: "Sinistros", value: financeOverview.totalIncidents },
    { name: "Seguros", value: financeOverview.totalInsuranceCost },
  ].filter((item) => item.value > 0);

  const recentEntries = useMemo<RecentEntry[]>(() => {
    const expenseRows = expenses
      .filter((item) => (item.vehicleId ? vehicleIdSet.has(item.vehicleId) : true))
      .map((item) => ({
        id: item._id,
        type: labelForExpenseCategory(item.category),
        resource: "expenses" as const,
        icon: Receipt,
        vehicleId: item.vehicleId,
        driverId: item.driverId,
        date: item.occurredAt,
        description: item.description,
        status: item.subcategory?.trim() || "Despesa",
        amount: toNumber(item.amount),
        raw: item as unknown as Record<string, unknown>,
      }));

    const fineRows = fines
      .filter((item) => (item.vehicleId ? vehicleIdSet.has(item.vehicleId) : true))
      .map((item) => ({
        id: item._id,
        type: "Multa",
        resource: "fines" as const,
        icon: TriangleAlert,
        vehicleId: item.vehicleId,
        driverId: item.driverId,
        date: item.occurredAt,
        description: item.infractionCode || "Multa lançada",
        status:
          item.status === "paid"
            ? "Paga"
            : item.status === "appealed"
              ? "Em recurso"
              : item.status === "cancelled"
                ? "Cancelada"
                : "Aberta",
        amount: toNumber(item.amount),
        raw: item as unknown as Record<string, unknown>,
      }));

    const incidentRows = incidents
      .filter((item) => (item.vehicleId ? vehicleIdSet.has(item.vehicleId) : true))
      .map((item) => ({
        id: item._id,
        type: "Sinistro",
        resource: "incidents" as const,
        icon: Shield,
        vehicleId: item.vehicleId,
        driverId: item.driverId,
        date: item.occurredAt,
        description: item.description || "Sinistro registrado",
        status:
          item.status === "closed"
            ? "Fechado"
            : item.status === "investigating"
              ? "Investigando"
              : "Aberto",
        amount: toNumber(item.amount),
        raw: item as unknown as Record<string, unknown>,
      }));

    const insuranceRows = insurances
      .filter((item) => (item.vehicleId ? vehicleIdSet.has(item.vehicleId) : true))
      .map((item) => ({
        id: item._id,
        type: "Seguro",
        resource: "insurances" as const,
        icon: Shield,
        vehicleId: item.vehicleId,
        driverId: undefined,
        date: item.startsAt,
        description: `${item.provider || "Seguradora"} - ${item.policyNumber || "Apólice"}`,
        status:
          item.status === "expired"
            ? "Expirado"
            : item.status === "cancelled"
              ? "Cancelado"
              : "Ativo",
        amount: toNumber(item.premiumAmount),
        raw: item as unknown as Record<string, unknown>,
      }));

    return [...expenseRows, ...fineRows, ...incidentRows, ...insuranceRows]
      .sort(
        (a, b) =>
          new Date(String(b.date ?? 0)).getTime() -
          new Date(String(a.date ?? 0)).getTime(),
      )
      .slice(0, 12);
  }, [expenses, fines, incidents, insurances, vehicleIdSet]);

  function handleCreateEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    const form = new FormData(event.currentTarget);
    const vehicleId = String(form.get("vehicleId") ?? "");
    const driverId = String(form.get("driverId") ?? "") || undefined;

    if (!vehicleId) {
      setFormError("Selecione o veículo.");
      return;
    }

    if (entryType === "fine") {
      const payload = {
        vehicleId,
        driverId,
        amount: Number(form.get("amount") ?? 0),
        occurredAt: String(form.get("occurredAt") ?? ""),
        dueAt: String(form.get("dueAt") ?? "") || undefined,
        status: String(form.get("status") ?? "open"),
        infractionCode: String(form.get("infractionCode") ?? "") || undefined,
      };
      if (!payload.occurredAt || !Number.isFinite(payload.amount) || payload.amount <= 0) {
        setFormError("Preencha data e valor válidos para a multa.");
        return;
      }
      if (editingEntry) {
        updateEntryMutation.mutate({ resource: "fines", id: editingEntry.id, payload });
      } else {
        createEntryMutation.mutate({ type: entryType, payload });
      }
      return;
    }

    if (entryType === "incident") {
      const payload = {
        vehicleId,
        driverId,
        amount: Number(form.get("amount") ?? 0),
        occurredAt: String(form.get("occurredAt") ?? ""),
        severity: String(form.get("severity") ?? "medium"),
        description: String(form.get("description") ?? ""),
        status: String(form.get("status") ?? "open"),
      };
      if (!payload.occurredAt || !payload.description.trim()) {
        setFormError("Preencha data e descrição do sinistro.");
        return;
      }
      if (editingEntry) {
        updateEntryMutation.mutate({ resource: "incidents", id: editingEntry.id, payload });
      } else {
        createEntryMutation.mutate({ type: entryType, payload });
      }
      return;
    }

    if (entryType === "insurance") {
      const payload = {
        vehicleId,
        provider: String(form.get("provider") ?? ""),
        policyNumber: String(form.get("policyNumber") ?? ""),
        startsAt: String(form.get("startsAt") ?? ""),
        expiresAt: String(form.get("expiresAt") ?? ""),
        premiumAmount: Number(form.get("premiumAmount") ?? 0),
        status: String(form.get("status") ?? "active"),
      };
      if (
        !payload.provider.trim() ||
        !payload.policyNumber.trim() ||
        !payload.startsAt ||
        !payload.expiresAt
      ) {
        setFormError("Preencha seguradora, apólice e vigência.");
        return;
      }
      if (editingEntry) {
        updateEntryMutation.mutate({ resource: "insurances", id: editingEntry.id, payload });
      } else {
        createEntryMutation.mutate({ type: entryType, payload });
      }
      return;
    }

    const payload = {
      vehicleId,
      driverId,
      category: String(form.get("category") ?? "outros"),
      subcategory: String(form.get("subcategory") ?? "") || undefined,
      description: String(form.get("description") ?? ""),
      amount: Number(form.get("amount") ?? 0),
      occurredAt: String(form.get("occurredAt") ?? ""),
      costCenter: String(form.get("costCenter") ?? "") || undefined,
      vendor: String(form.get("vendor") ?? "") || undefined,
      documentNumber: String(form.get("documentNumber") ?? "") || undefined,
    };
    if (!payload.description.trim() || !payload.occurredAt) {
      setFormError("Preencha descrição e data da despesa.");
      return;
    }
    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      setFormError("Informe um valor válido para a despesa.");
      return;
    }
    if (editingEntry) {
      updateEntryMutation.mutate({ resource: "expenses", id: editingEntry.id, payload });
    } else {
      createEntryMutation.mutate({ type: entryType, payload });
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Financeiro da frota</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Custos por natureza, custo por km e eficiência média calculados com
            base real por veículo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadResourceExport("fuel-records")}>
            <Download size={18} />
            Abastecimentos
          </Button>
          <Button variant="secondary" onClick={() => downloadResourceExport("expenses")}>
            <Download size={18} />
            Despesas
          </Button>
          <Button variant="secondary" onClick={() => downloadResourceExport("fines")}>
            <Download size={18} />
            Multas
          </Button>
          <Button variant="secondary" onClick={() => downloadResourceExport("incidents")}>
            <Download size={18} />
            Sinistros
          </Button>
          <Button variant="secondary" onClick={() => downloadResourceExport("insurances")}>
            <Download size={18} />
            Seguros
          </Button>
          <Button
            onClick={() => {
              setEditingEntry(null);
              setEntryType("expense");
              setIsEntryModalOpen(true);
            }}
          >
            <Plus size={18} />
            Novo lançamento
          </Button>
        </div>
      </section>

      <FilterPanel
        description="Filtre a visão financeira por status, centro de custo, setor e cidade."
        isExpanded={filtersExpanded}
        onToggleExpanded={() => setFiltersExpanded((current) => !current)}
        searchSlot={
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-zinc-400" size={18} />
            <Input
              className="pl-10"
              placeholder="Buscar placa, modelo ou apelido"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
            />
          </div>
        }
        expandedContent={
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SearchableSelect
                value={filters.status}
                onValueChange={(value) =>
                  setFilters((current) => ({ ...current, status: value }))
                }
                placeholder="Status"
                options={[
                  { value: "", label: "Todos" },
                  { value: "available", label: "Disponível" },
                  { value: "in_route", label: "Em rota" },
                  { value: "maintenance", label: "Manutenção" },
                  { value: "inactive", label: "Inativo" },
                  { value: "blocked", label: "Bloqueado" },
                ]}
              />
              <Input
                placeholder="Centro de custo"
                value={filters.costCenter}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, costCenter: event.target.value }))
                }
              />
              <Input
                placeholder="Setor"
                value={filters.sector}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, sector: event.target.value }))
                }
              />
              <Input
                placeholder="Cidade"
                value={filters.city}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, city: event.target.value }))
                }
              />
            </div>
            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={() =>
                  setFilters({
                    search: "",
                    status: "",
                    costCenter: "",
                    sector: "",
                    city: "",
                  })
                }
              >
                <Filter size={18} />
                Limpar
              </Button>
            </div>
          </div>
        }
      >
        {null}
      </FilterPanel>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Custo operacional total"
          value={formatCurrency(financeOverview.totalOperationalCost)}
          detail="Combustível, manutenção, despesas, multas, sinistros e seguros"
          icon={CreditCard}
          tone="amber"
        />
        <StatCard
          label="Km/L médio da frota"
          value={
            financeOverview.averageKmPerLiter > 0
              ? formatMetric(financeOverview.averageKmPerLiter, "km/L")
              : "-"
          }
          detail={`${financeOverview.totalEfficiencyDistanceKm.toLocaleString("pt-BR")} km analisados`}
          icon={TrendingUp}
          tone="cyan"
        />
        <StatCard
          label="Custo por km"
          value={
            financeOverview.averageCostPerKm > 0
              ? formatMetric(financeOverview.averageCostPerKm, "R$/km")
              : "-"
          }
          detail={`${financeOverview.totalDistanceDrivenKm.toLocaleString("pt-BR")} km acumulados`}
          icon={BarChart3}
          tone="cyan"
        />
        <StatCard
          label="Combustível"
          value={formatCurrency(financeOverview.totalFuelCost)}
          detail={`${fuelRecords.reduce((sum, item) => sum + toNumber(item.liters), 0).toLocaleString("pt-BR")} L registrados`}
          icon={Fuel}
          tone="green"
        />
        <StatCard
          label="Manutenção"
          value={formatCurrency(financeOverview.totalMaintenanceCost)}
          detail="Ordens com impacto financeiro"
          icon={Wrench}
          tone="amber"
        />
        <StatCard
          label="Custo médio por veículo"
          value={formatCurrency(financeOverview.averageCostPerVehicle)}
          detail={`${vehicleSummaries.length} veículos considerados`}
          icon={Receipt}
          tone="green"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <Card>
          <CardHeader>
            <CardTitle>Estrutura de custos</CardTitle>
            <p className="text-sm text-zinc-500">
              Distribuição consolidada por natureza financeira.
            </p>
          </CardHeader>
          <CardContent className="h-80">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={68} outerRadius={110} paddingAngle={3}>
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                Nenhum custo encontrado para os filtros selecionados.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Lançamentos financeiros</CardTitle>
              <p className="text-sm text-zinc-500">
                Despesas, multas, sinistros e seguros no mesmo fluxo.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setEditingEntry(null);
                setEntryType("expense");
                setIsEntryModalOpen(true);
              }}
            >
              <Plus size={18} />
              Novo lançamento
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Tipo</Th>
                  <Th>Data</Th>
                  <Th>Veículo</Th>
                  <Th>Motorista</Th>
                  <Th>Descrição</Th>
                  <Th>Status</Th>
                  <Th>Valor</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((entry) => (
                  <tr key={`${entry.type}-${entry.id}`}>
                    <Td>
                      <span className="inline-flex items-center gap-2">
                        <entry.icon size={15} className="text-zinc-500" />
                        {entry.type}
                      </span>
                    </Td>
                    <Td>{formatDate(entry.date)}</Td>
                    <Td>{vehicles.find((vehicle) => vehicle._id === entry.vehicleId)?.plate ?? "-"}</Td>
                    <Td>{drivers.find((driver) => driver._id === entry.driverId)?.name ?? "-"}</Td>
                    <Td>{entry.description}</Td>
                    <Td>
                      <Badge tone="cyan">{entry.status}</Badge>
                    </Td>
                    <Td>{formatCurrency(entry.amount)}</Td>
                    <Td>
                      <ActionMenu
                        items={[
                          {
                            label: "Editar",
                            icon: <Edit2 size={15} />,
                            onClick: () => {
                              setEditingEntry(entry);
                              setEntryType(
                                entry.resource === "expenses"
                                  ? "expense"
                                  : entry.resource === "fines"
                                    ? "fine"
                                    : entry.resource === "incidents"
                                      ? "incident"
                                      : "insurance",
                              );
                              setFormError(undefined);
                              setIsEntryModalOpen(true);
                            },
                          },
                          {
                            label: "Excluir",
                            icon: <Trash2 size={15} />,
                            danger: true,
                            disabled: deleteEntryMutation.isPending,
                            onClick: () => {
                              if (window.confirm(`Excluir ${entry.type.toLowerCase()}?`)) {
                                deleteEntryMutation.mutate({
                                  resource: entry.resource,
                                  id: entry.id,
                                });
                              }
                            },
                          },
                        ]}
                      />
                    </Td>
                  </tr>
                ))}
                {recentEntries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-sm text-zinc-500">
                      Nenhum lançamento financeiro encontrado para os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Consolidado por veículo</CardTitle>
          <p className="text-sm text-zinc-500">
            Custos totais, km/l médio e custo por km com base no odômetro inicial e nos abastecimentos registrados.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>Veículo</Th>
                <Th>Combustível</Th>
                <Th>Manutenção</Th>
                <Th>Extras</Th>
                <Th>Total</Th>
                <Th>Km/L médio</Th>
                <Th>Custo/km</Th>
              </tr>
            </thead>
            <tbody>
              {vehicleSummaries
                .slice()
                .sort((left, right) => right.totalOperationalCost - left.totalOperationalCost)
                .map((item) => (
                  <tr key={item.vehicle._id}>
                    <Td>
                      <div>
                        <strong>{item.vehicle.plate} - {item.vehicle.nickname ?? item.vehicle.model}</strong>
                        <span className="mt-1 block text-xs text-zinc-500">
                          {item.vehicle.costCenter || "Sem centro de custo"} | {item.vehicle.city || "Sem cidade"}
                        </span>
                      </div>
                    </Td>
                    <Td>{formatCurrency(item.fuelCost)}</Td>
                    <Td>{formatCurrency(item.maintenanceCost)}</Td>
                    <Td>{formatCurrency(item.expenseCost + item.fineCost + item.incidentCost + item.insuranceCost)}</Td>
                    <Td><strong>{formatCurrency(item.totalOperationalCost)}</strong></Td>
                    <Td>
                      <Badge tone="cyan">
                        {item.averageKmPerLiter > 0 ? formatMetric(item.averageKmPerLiter, "km/L") : "-"}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge tone="amber">
                        {item.costPerKm > 0 ? formatMetric(item.costPerKm, "R$/km") : "-"}
                      </Badge>
                    </Td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Modal
        open={isEntryModalOpen}
        title={editingEntry ? "Editar lançamento financeiro" : "Novo lançamento financeiro"}
        description="Escolha o tipo do lançamento e preencha os dados específicos."
        onClose={() => {
          setIsEntryModalOpen(false);
          setEditingEntry(null);
          setFormError(undefined);
        }}
      >
        <form
          key={editingEntry ? `${editingEntry.resource}-${editingEntry.id}` : "new-entry"}
          className="space-y-4"
          onSubmit={handleCreateEntry}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Tipo de despesa
              <SearchableSelect
                value={entryType}
                onValueChange={(value) => setEntryType(value as ExpenseType)}
                options={expenseTypeOptions}
              />
            </label>

            <label className="space-y-2 text-sm font-medium">
              Veículo
              <SearchableSelect
                name="vehicleId"
                defaultValue={String(editingEntry?.vehicleId ?? "")}
                options={vehicleOptions}
                placeholder="Selecione o veículo"
                searchPlaceholder="Buscar veículo"
              />
            </label>

            <label className="space-y-2 text-sm font-medium">
              Motorista
              <SearchableSelect
                name="driverId"
                defaultValue={String(editingEntry?.driverId ?? "")}
                options={[{ value: "", label: "Sem motorista" }, ...driverOptions]}
                placeholder="Selecione o motorista"
                searchPlaceholder="Buscar motorista"
              />
            </label>

            {entryType === "expense" && (
              <>
                <label className="space-y-2 text-sm font-medium">
                  Categoria
                  <SearchableSelect
                    name="category"
                    defaultValue={String((editingEntry?.raw.category as string) ?? "outros")}
                    options={expenseCategoryOptions}
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Subcategoria
                  <Input
                    name="subcategory"
                    defaultValue={String((editingEntry?.raw.subcategory as string) ?? "")}
                    placeholder="Ex.: IPVA, vistoria, pneu dianteiro"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium md:col-span-2">
                  Descrição
                  <Input
                    name="description"
                    defaultValue={String((editingEntry?.raw.description as string) ?? "")}
                    placeholder="Descreva a despesa"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Valor
                  <Input
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={String((editingEntry?.raw.amount as number) ?? "")}
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Data
                  <Input
                    name="occurredAt"
                    type="date"
                    defaultValue={String((editingEntry?.raw.occurredAt as string) ?? "").slice(0, 10)}
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Centro de custo
                  <Input
                    name="costCenter"
                    defaultValue={String((editingEntry?.raw.costCenter as string) ?? "")}
                    placeholder="Ex.: Operação Norte"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Fornecedor
                  <Input
                    name="vendor"
                    defaultValue={String((editingEntry?.raw.vendor as string) ?? "")}
                    placeholder="Ex.: Posto, oficina, órgão"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium md:col-span-2">
                  Número do documento
                  <Input
                    name="documentNumber"
                    defaultValue={String((editingEntry?.raw.documentNumber as string) ?? "")}
                    placeholder="Ex.: NF 12345"
                  />
                </label>
              </>
            )}

            {entryType === "fine" && (
              <>
                <label className="space-y-2 text-sm font-medium">
                  Valor
                  <Input name="amount" type="number" min="0" step="0.01" defaultValue={String((editingEntry?.raw.amount as number) ?? "")} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Data da multa
                  <Input name="occurredAt" type="date" defaultValue={String((editingEntry?.raw.occurredAt as string) ?? "").slice(0, 10)} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Vencimento
                  <Input name="dueAt" type="date" defaultValue={String((editingEntry?.raw.dueAt as string) ?? "").slice(0, 10)} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Status
                  <SearchableSelect
                    name="status"
                    defaultValue={String((editingEntry?.raw.status as string) ?? "open")}
                    options={[
                      { value: "open", label: "Aberta" },
                      { value: "paid", label: "Paga" },
                      { value: "appealed", label: "Em recurso" },
                      { value: "cancelled", label: "Cancelada" },
                    ]}
                  />
                </label>
                <label className="space-y-2 text-sm font-medium md:col-span-2">
                  Código da infração
                  <Input name="infractionCode" defaultValue={String((editingEntry?.raw.infractionCode as string) ?? "")} placeholder="Ex.: 745-5 excesso de velocidade" />
                </label>
              </>
            )}

            {entryType === "incident" && (
              <>
                <label className="space-y-2 text-sm font-medium">
                  Valor estimado
                  <Input name="amount" type="number" min="0" step="0.01" defaultValue={String((editingEntry?.raw.amount as number) ?? "")} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Data do sinistro
                  <Input name="occurredAt" type="date" defaultValue={String((editingEntry?.raw.occurredAt as string) ?? "").slice(0, 10)} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Severidade
                  <SearchableSelect
                    name="severity"
                    defaultValue={String((editingEntry?.raw.severity as string) ?? "medium")}
                    options={[
                      { value: "low", label: "Baixa" },
                      { value: "medium", label: "Média" },
                      { value: "high", label: "Alta" },
                      { value: "critical", label: "Crítica" },
                    ]}
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Status
                  <SearchableSelect
                    name="status"
                    defaultValue={String((editingEntry?.raw.status as string) ?? "open")}
                    options={[
                      { value: "open", label: "Aberto" },
                      { value: "investigating", label: "Investigando" },
                      { value: "closed", label: "Fechado" },
                    ]}
                  />
                </label>
                <label className="space-y-2 text-sm font-medium md:col-span-2">
                  Descrição
                  <Input name="description" defaultValue={String((editingEntry?.raw.description as string) ?? "")} placeholder="Descreva o sinistro" />
                </label>
              </>
            )}

            {entryType === "insurance" && (
              <>
                <label className="space-y-2 text-sm font-medium">
                  Seguradora
                  <Input name="provider" defaultValue={String((editingEntry?.raw.provider as string) ?? "")} placeholder="Nome da seguradora" />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Apólice
                  <Input name="policyNumber" defaultValue={String((editingEntry?.raw.policyNumber as string) ?? "")} placeholder="Número da apólice" />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Início da vigência
                  <Input name="startsAt" type="date" defaultValue={String((editingEntry?.raw.startsAt as string) ?? "").slice(0, 10)} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Fim da vigência
                  <Input name="expiresAt" type="date" defaultValue={String((editingEntry?.raw.expiresAt as string) ?? "").slice(0, 10)} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Prêmio
                  <Input name="premiumAmount" type="number" min="0" step="0.01" defaultValue={String((editingEntry?.raw.premiumAmount as number) ?? "")} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Status
                  <SearchableSelect
                    name="status"
                    defaultValue={String((editingEntry?.raw.status as string) ?? "active")}
                    options={[
                      { value: "active", label: "Ativo" },
                      { value: "expired", label: "Expirado" },
                      { value: "cancelled", label: "Cancelado" },
                    ]}
                  />
                </label>
              </>
            )}
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
              onClick={() => {
                setIsEntryModalOpen(false);
                setFormError(undefined);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createEntryMutation.isPending || updateEntryMutation.isPending}>
              {createEntryMutation.isPending || updateEntryMutation.isPending
                ? "Salvando..."
                : editingEntry
                  ? "Salvar alterações"
                  : "Salvar lançamento"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
