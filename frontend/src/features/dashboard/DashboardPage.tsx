import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Car,
  Fuel,
  Gauge,
  ReceiptText,
  UsersRound,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "../../components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { LoadingState } from "../../components/ui/loading-state";
import { SearchableSelect } from "../../components/ui/searchable-select";
import { StatCard } from "../../components/ui/stat-card";
import { VehicleTypeIcon } from "../../components/vehicle-type-icon";
import {
  getDashboard,
  getDashboardFuelSeries,
  getVehicles,
} from "../../lib/api";
import {
  labelFor,
  maintenanceTypeLabels,
  priorityLabels,
  severityLabels,
} from "../../lib/labels";

import { formatCurrency, formatDate, formatPercent } from "../../lib/utils";

const statusLabels: Record<string, string> = {
  available: "Disponível",
  in_route: "Em rota",
  stopped: "Parado",
  maintenance: "Manutenção",
  inactive: "Inativo",
  blocked: "Bloqueado",
};

const statusColors: Record<string, string> = {
  available: "#0f8f63",
  in_route: "#027f9f",
  stopped: "#b7791f",
  maintenance: "#c2413b",
  inactive: "#71717a",
  blocked: "#161816",
};

const chartTooltipStyle = {
  border: "1px solid #dfe4e8",
  borderRadius: 8,
  boxShadow: "0 12px 30px rgba(22, 24, 22, 0.12)",
};

const fuelLabels: Record<string, string> = {
  gasoline: "Gasolina",
  ethanol: "Etanol",
  diesel: "Diesel",
  gnv: "GNV",
  electric: "Eletrico",
  unknown: "Não informado",
};

const fuelTypeColors = [
  "#0f8f63",
  "#027f9f",
  "#b7791f",
  "#c2413b",
  "#3b82f6",
  "#71717a",
];

const alertTypeLabels: Record<string, string> = {
  maintenance_due: "Manutenção próxima",
  document_expiring: "Documento vencendo",
  speeding: "Excesso de velocidade",
  geofence_enter: "Entrada em geocerca",
  geofence_exit: "Saída de geocerca",
  idle_too_long: "Veículo parado",
  low_battery: "Bateria baixa",
  fuel_anomaly: "Anomalia de consumo",
};

function safeNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function CostBreakdownTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: Record<string, unknown> }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload ?? {};
  const total = safeNumber(point.total);
  const fuelCost = safeNumber(point.fuelCost);
  const maintenanceCost = safeNumber(point.maintenanceCost);
  const expenseCost = safeNumber(point.expenseCost);
  const liters = safeNumber(point.liters);

  return (
    <div
      className="min-w-[220px] rounded-lg border border-slate-200 bg-white p-3 shadow-[0_12px_30px_rgba(22,24,22,0.12)]"
      style={chartTooltipStyle}
    >
      <p className="text-sm font-semibold text-fleet-ink">{label}</p>
      <div className="mt-2 space-y-1.5 text-sm text-zinc-600">
        <div className="flex items-center justify-between gap-3">
          <span>Custo total</span>
          <strong className="text-fleet-green">{formatCurrency(total)}</strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Combustível</span>
          <span>{formatCurrency(fuelCost)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Manutenção</span>
          <span>{formatCurrency(maintenanceCost)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Outras despesas</span>
          <span>{formatCurrency(expenseCost)}</span>
        </div>
      </div>
    </div>
  );
}

function FuelByDayTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: Record<string, unknown> }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload ?? {};
  const liters = safeNumber(point.liters);
  const total = safeNumber(point.total ?? point.totalCost);

  return (
    <div
      className="min-w-[220px] rounded-lg border border-fleet-line bg-white p-3 shadow-[0_12px_30px_rgba(22,24,22,0.12)]"
      style={chartTooltipStyle}
    >
      <p className="text-sm font-semibold text-fleet-ink">{label}</p>
      <div className="mt-2 space-y-1.5 text-sm text-zinc-600">
        <div className="flex items-center justify-between gap-3">
          <span>Abastecido</span>
          <strong className="text-cyan-700">
            {liters.toLocaleString("pt-BR")} L
          </strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Valor no dia</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const today = new Date().toISOString().slice(0, 10);
  const firstDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  )
    .toISOString()
    .slice(0, 10);
  const lastDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0,
  )
    .toISOString()
    .slice(0, 10);
  const [from, setFrom] = useState(firstDayOfMonth);
  const [to, setTo] = useState(lastDayOfMonth);
  const [selectedFuelVehicleId, setSelectedFuelVehicleId] = useState("");
  const [fuelSeriesGranularity, setFuelSeriesGranularity] = useState<
    "day" | "month" | "year"
  >("day");
  const {
    data = {
      kpis: {
        totalVehicles: 0,
        availableVehicles: 0,
        activeDrivers: 0,
        openAlerts: 0,
        availability: 0,
        totalFuelCost: 0,
        totalFuelLiters: 0,
        totalMaintenanceCost: 0,
        totalExpenseCost: 0,
        totalOperationalCost: 0,
        averageFuelCost: 0,
      },
      vehiclesByStatus: [],
      criticalVehicles: [],
      upcomingMaintenance: [],
      expiringDocuments: [],
      costByDay: [],
      costByMonth: [],
      fuelByVehicle: [],
      topFuelCostVehicles: [],
      fuelByType: [],
      dashboardPeriod: {
        from: firstDayOfMonth,
        to: today,
      },
      recentAlerts: [],
      generatedAt: new Date().toISOString(),
    },
    isLoading,
  } = useQuery({
    queryKey: ["dashboard", from, to],
    queryFn: () => getDashboard({ from, to }),
    refetchInterval: 30_000,
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles(),
  });
  const { data: fuelSeries } = useQuery({
    queryKey: [
      "dashboard-fuel-series",
      from,
      to,
      selectedFuelVehicleId,
      fuelSeriesGranularity,
    ],
    queryFn: () =>
      getDashboardFuelSeries({
        from,
        to,
        vehicleId: selectedFuelVehicleId || undefined,
        granularity: fuelSeriesGranularity,
      }),
    refetchInterval: 30_000,
  });

  const costByMonth = data.costByMonth.slice(-12).map((point) => ({
    month: `${String(point._id.month).padStart(2, "0")}/${point._id.year}`,
    total: safeNumber(point.total),
    liters: safeNumber(point.liters),
    fuelCost: safeNumber(point.fuelCost ?? point.total),
    maintenanceCost: safeNumber(point.maintenanceCost),
    expenseCost: safeNumber(point.expenseCost),
  }));

  const costByDay =
    data.costByDay?.map((point) => ({
      day: `${String(point._id.day).padStart(2, "0")}/${String(point._id.month).padStart(2, "0")}`,
      total: safeNumber(point.total),
      liters: safeNumber(point.liters),
      fuelCost: safeNumber(point.fuelCost ?? point.total),
      maintenanceCost: safeNumber(point.maintenanceCost),
      expenseCost: safeNumber(point.expenseCost),
    })) || [];

  const dashboardVehicleOptions = [
    { value: "", label: "Todos os veículos" },
    ...vehicles.map((vehicle) => ({
      value: vehicle._id,
      label: `${vehicle.plate} - ${vehicle.nickname ?? vehicle.model}`,
      searchText: `${vehicle.plate} ${vehicle.nickname ?? ""} ${vehicle.brand} ${vehicle.model}`,
    })),
  ];
  const fuelSeriesData =
    fuelSeries?.points.map((point) => ({
      label: point.label,
      liters: safeNumber(point.liters),
      totalCost: safeNumber(point.totalCost),
      records: safeNumber(point.records),
    })) ?? [];

  const hasDailyData = costByDay.some(
    (point) => Number(point.total) > 0 || Number(point.liters) > 0,
  );
  const hasFuelSeries = fuelSeriesData.some((point) => point.liters > 0);
  const totalOperationalCost =
    data.kpis.totalOperationalCost ??
    safeNumber(data.kpis.totalFuelCost) +
      safeNumber(data.kpis.totalMaintenanceCost) +
      safeNumber(data.kpis.totalExpenseCost);
  const totalFuelCost = safeNumber(data.kpis.totalFuelCost);
  const totalMaintenanceCost = safeNumber(data.kpis.totalMaintenanceCost);
  const totalExpenseCost = safeNumber(data.kpis.totalExpenseCost);
  const totalFuelLiters = safeNumber(data.kpis.totalFuelLiters);
  const averageFuelCost = safeNumber(data.kpis.averageFuelCost);
  const fuelByTypeData =
    data.fuelByType?.map((item) => ({
      name: fuelLabels[item.fuelType] ?? item.fuelType,
      value: safeNumber(item.totalCost),
      liters: safeNumber(item.totalLiters),
      records: safeNumber(item.records),
    })) ?? [];
  const statusOperationalData = data.vehiclesByStatus.map((item) => ({
    name: statusLabels[item._id] ?? item._id,
    value: safeNumber(item.count),
    fill: statusColors[item._id] ?? "#71717a",
  }));
  const rankingCostData = data.topFuelCostVehicles
    .slice(0, 8)
    .map((vehicle, index) => ({
      name: vehicle.plate,
      label: vehicle.label,
      totalCost: safeNumber(vehicle.totalCost),
      litros: safeNumber(vehicle.totalLiters),
      lancamentos: safeNumber(vehicle.records),
      fill:
        index === 0
          ? "#c2413b"
          : index < 3
            ? "#b7791f"
            : "#0f8f63",
    }))
    .reverse();
  const totalVehicles = safeNumber(data.kpis.totalVehicles);
  const efficiencyRanking = data.fuelByVehicle
    .filter((vehicle) => safeNumber(vehicle.averageKmPerLiter) > 0)
    .slice()
    .sort(
      (left, right) =>
        safeNumber(right.averageKmPerLiter) - safeNumber(left.averageKmPerLiter),
    );
  const operationalDistribution = statusOperationalData.map((item) => ({
    ...item,
    percent: totalVehicles ? (item.value / totalVehicles) * 100 : 0,
  }));
  const accumulatedCostItems = [
    {
      label: "Combustível",
      value: totalFuelCost,
      accent: "bg-emerald-500",
      icon: Fuel,
    },
    {
      label: "Manutenção",
      value: totalMaintenanceCost,
      accent: "bg-amber-500",
      icon: Wrench,
    },
    {
      label: "Outras despesas",
      value: totalExpenseCost,
      accent: "bg-rose-500",
      icon: ReceiptText,
    },
  ];
  const largestAccumulatedCost = Math.max(
    ...accumulatedCostItems.map((item) => item.value),
    1,
  );

  if (isLoading) {
    return <LoadingState label="Carregando dashboard..." />;
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-lg border border-fleet-line bg-white p-5 shadow-sm md:p-6">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fleet-green via-cyan-500 to-fleet-amber" />
        <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="mb-2 inline-flex rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold uppercase text-emerald-700">
              Visão executiva
            </span>
            <h2 className="text-2xl font-semibold text-fleet-ink">
              Dashboard operacional
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Filtre o perí­odo para analisar abastecimento, consumo e custos
              por veículo.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-fleet-ink">
              De
              <Input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-fleet-ink">
              Até
              <Input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Veí­culos"
          value={String(data.kpis.totalVehicles)}
          detail="Ativos"
          icon={Car}
          tone="green"
        />
        <StatCard
          label="Disponibilidade"
          value={formatPercent(data.kpis.availability)}
          detail={`${data.kpis.availableVehicles} liberados`}
          icon={Gauge}
          tone="cyan"
        />
        <StatCard
          label="Motoristas"
          value={String(data.kpis.activeDrivers)}
          detail="Operacionais"
          icon={UsersRound}
          tone="amber"
        />
        <StatCard
          label="Alertas abertos"
          value={String(data.kpis.openAlerts)}
          detail="Aguardando tratativa"
          icon={AlertTriangle}
          tone="red"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Custo total"
          value={formatCurrency(totalOperationalCost)}
          detail="Combustível, manutenção e despesas"
          icon={ReceiptText}
          tone="green"
        />
        <StatCard
          label="Combustível"
          value={formatCurrency(totalFuelCost)}
          detail={`${totalFuelLiters.toLocaleString("pt-BR")} L no período`}
          icon={Fuel}
          tone="cyan"
        />
        <StatCard
          label="Manutenção"
          value={formatCurrency(totalMaintenanceCost)}
          detail="Ordens no período"
          icon={Wrench}
          tone="amber"
        />
        <StatCard
          label="Outras despesas"
          value={formatCurrency(totalExpenseCost)}
          detail="Multas, seguros, impostos e extras"
          icon={ReceiptText}
          tone="red"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-fleet-line bg-zinc-50/70">
            <div>
              <CardTitle>Custos e consumo por dia</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Custo operacional total no período selecionado
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">Custo total</Badge>

              <Badge tone="amber">Atualização 30s</Badge>
            </div>
          </CardHeader>
          <CardContent className="h-96 bg-white">
            {hasDailyData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={costByDay}
                  margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id="cost" x1="0" x2="0" y1="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#0f8f63"
                        stopOpacity={0.28}
                      />
                      <stop offset="95%" stopColor="#0f8f63" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="#e5e7eb"
                    strokeDasharray="4 4"
                    vertical={false}
                  />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <Legend verticalAlign="bottom" height={28} />
                  <YAxis
                    yAxisId="cost"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `R$ ${Number(value) / 1000}k`}
                  />
                  <YAxis
                    yAxisId="liters"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${Number(value)} L`}
                  />
                  <Tooltip content={<CostBreakdownTooltip />} />
                  <Area
                    yAxisId="cost"
                    type="monotone"
                    dataKey="total"
                    name="Custo total"
                    stroke="#0f8f63"
                    strokeWidth={3}
                    fill="url(#cost)"
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="liters"
                    type="monotone"
                    dataKey="liters"
                    name="Litros"
                    stroke="#027f9f"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-96 items-center justify-center text-sm text-zinc-500">
                Nenhum custo ou abastecimento encontrado no período selecionado.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-fleet-line bg-zinc-50/70">
            <div>
              <CardTitle>Abastecimento por veículo</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Litros abastecidos por dia, mês ou ano, com filtro por carro.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 md:max-w-[360px] md:items-end">
              <SearchableSelect
                value={selectedFuelVehicleId}
                onValueChange={setSelectedFuelVehicleId}
                options={dashboardVehicleOptions}
                placeholder="Selecionar veículo"
                searchPlaceholder="Buscar placa ou apelido"
                className="w-full"
              />
              <div className="flex w-full flex-wrap gap-2 md:justify-end">
                {(["day", "month", "year"] as const).map((granularity) => (
                  <button
                    key={granularity}
                    type="button"
                    onClick={() => setFuelSeriesGranularity(granularity)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                      fuelSeriesGranularity === granularity
                        ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                        : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300"
                    }`}
                  >
                    {granularity === "day"
                      ? "Dia"
                      : granularity === "month"
                        ? "Mês"
                        : "Ano"}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-96 bg-white">
            {hasFuelSeries ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={fuelSeriesData}
                  margin={{ top: 18, right: 12, left: -12, bottom: 4 }}
                >
                  <CartesianGrid
                    stroke="#e5e7eb"
                    vertical={false}
                    strokeDasharray="4 4"
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#71717a", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#71717a", fontSize: 12 }}
                    tickFormatter={(value) => `${Number(value)} L`}
                  />
                  <Tooltip content={<FuelByDayTooltip />} />
                  <Bar
                    dataKey="liters"
                    name="Litros"
                    radius={[8, 8, 0, 0]}
                    fill="#06b6d4"
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-96 items-center justify-center text-sm text-zinc-500">
                Nenhum abastecimento encontrado para o filtro selecionado.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-fleet-line bg-zinc-50/70">
            <div>
              <CardTitle>Histórico 12 meses</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">Custo total mensal</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">Custo total</Badge>
            </div>
          </CardHeader>
          <CardContent className="h-96 bg-white">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={costByMonth.slice(-12)}
                margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
              >
                <defs>
                  <linearGradient id="month-cost" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="#e5e7eb"
                  strokeDasharray="4 4"
                  vertical={false}
                />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <Legend verticalAlign="bottom" height={28} />
                <YAxis
                  yAxisId="cost"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `R$ ${Number(value) / 1000}k`}
                />
                <YAxis
                  yAxisId="liters"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${Number(value)} L`}
                />
                <Tooltip content={<CostBreakdownTooltip />} />
                <Area
                  yAxisId="cost"
                  type="monotone"
                  dataKey="total"
                  name="Custo total"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fill="url(#month-cost)"
                />
                <Line
                  yAxisId="liters"
                  type="monotone"
                  dataKey="liters"
                  name="Litros"
                  stroke="#0f8f63"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-fleet-line bg-zinc-50/70">
            <div>
              <CardTitle>Custos acumulados</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Composição operacional consolidada do período.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="rounded-lg border border-fleet-line bg-[linear-gradient(135deg,rgba(15,143,99,0.10),rgba(2,127,159,0.06))] p-4">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Total operacional
              </span>
              <strong className="mt-2 block text-3xl text-fleet-ink">
                {formatCurrency(totalOperationalCost)}
              </strong>
              <p className="mt-2 text-sm text-zinc-500">
                Combustível, manutenção e despesas financeiras consolidadas.
              </p>
            </div>

            <div className="space-y-3">
              {accumulatedCostItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="rounded-lg border border-fleet-line bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-50 text-fleet-ink">
                          <Icon size={18} />
                        </span>
                        <div>
                          <strong className="block text-sm text-fleet-ink">
                            {item.label}
                          </strong>
                          <span className="text-xs text-zinc-500">
                            {formatCurrency(item.value)}
                          </span>
                        </div>
                      </div>
                      <Badge tone="green">
                        {formatPercent((item.value / Math.max(totalOperationalCost, 1)) * 100)}
                      </Badge>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={`h-full rounded-full ${item.accent}`}
                        style={{
                          width: `${(item.value / largestAccumulatedCost) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-fleet-line p-4">
                <span className="text-sm text-zinc-500">Litros registrados</span>
                <strong className="mt-2 block text-2xl text-fleet-ink">
                  {totalFuelLiters.toLocaleString("pt-BR")} L
                </strong>
              </div>
              <div className="rounded-lg border border-fleet-line p-4">
                <span className="text-sm text-zinc-500">
                  Preço médio por litro
                </span>
                <strong className="mt-2 block text-2xl text-fleet-ink">
                  {formatCurrency(averageFuelCost)}
                </strong>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-fleet-line bg-zinc-50/70">
            <div>
              <CardTitle>Combustível por tipo</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Valor em reais e total de litros no período selecionado.
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="h-72">
              {fuelByTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fuelByTypeData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={98}
                      paddingAngle={3}
                    >
                      {fuelByTypeData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={fuelTypeColors[index % fuelTypeColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value, name, item) => [
                        `${formatCurrency(Number(value))} | ${Number(item.payload.liters).toLocaleString("pt-BR")} L`,
                        name,
                      ]}
                    />
                    <Legend verticalAlign="bottom" height={28} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-72 items-center justify-center text-sm text-zinc-500">
                  Nenhum abastecimento no período selecionado.
                </div>
              )}
            </div>
            <div className="space-y-3">
              {fuelByTypeData.map((item, index) => (
                <div
                  key={item.name}
                  className="rounded-lg border border-fleet-line p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-semibold text-fleet-ink">
                      <span
                        className="h-3 w-3 rounded-sm"
                        style={{
                          backgroundColor:
                            fuelTypeColors[index % fuelTypeColors.length],
                        }}
                      />
                      {item.name}
                    </span>
                    <span className="text-sm font-semibold">
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {item.liters.toLocaleString("pt-BR")} L em {item.records}{" "}
                    lançamento(s)
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Status operacional</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Distribuição atual da frota por status.
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="h-72">
              {operationalDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={operationalDistribution}
                    layout="vertical"
                    margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid stroke="#eef2f7" horizontal={false} />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${Number(value)}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value, _name, item) => [
                        `${Number(item.payload?.value ?? 0).toLocaleString("pt-BR")} veículo(s) | ${Number(value).toLocaleString("pt-BR", {
                          maximumFractionDigits: 1,
                        })}%`,
                        "Participação",
                      ]}
                    />
                    <Bar dataKey="percent" radius={[0, 6, 6, 0]}>
                      {operationalDistribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  Sem veículos classificados.
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {operationalDistribution.map((item) => (
                <div
                  key={item.name}
                  className="rounded-lg border border-fleet-line p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-semibold text-fleet-ink">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.fill }}
                      />
                      {item.name}
                    </span>
                    <span className="text-sm font-semibold text-fleet-ink">
                      {item.value.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    {item.percent.toLocaleString("pt-BR", {
                      maximumFractionDigits: 1,
                    })}
                    % da frota
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Custo e consumo por carro</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Total de litros e valor abastecido dentro do período filtrado.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-fleet-line px-4 py-3 font-semibold text-zinc-600">
                      Veículo
                    </th>
                    <th className="border-b border-fleet-line px-4 py-3 font-semibold text-zinc-600">
                      Litros
                    </th>
                    <th className="border-b border-fleet-line px-4 py-3 font-semibold text-zinc-600">
                      Custo
                    </th>
                    <th className="border-b border-fleet-line px-4 py-3 font-semibold text-zinc-600">
                      Km/L
                    </th>
                    <th className="border-b border-fleet-line px-4 py-3 font-semibold text-zinc-600">
                      Lançamentos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.fuelByVehicle.map((vehicle) => (
                    <tr key={vehicle.vehicleId}>
                      <td className="border-b border-zinc-100 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <VehicleTypeIcon type={vehicle.type} />
                          <div>
                            <strong>{vehicle.plate}</strong>
                            <span className="block text-xs text-zinc-500">
                              {vehicle.label}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-3">
                        {vehicle.totalLiters.toLocaleString("pt-BR")} L
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-3">
                        {formatCurrency(vehicle.totalCost)}
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-3">
                        {vehicle.averageKmPerLiter
                          ? `${vehicle.averageKmPerLiter.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km/L`
                          : "-"}
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-3">
                        {vehicle.records}
                      </td>
                    </tr>
                  ))}
                  {data.fuelByVehicle.length === 0 && (
                    <tr>
                      <td
                        className="px-4 py-6 text-sm text-zinc-500"
                        colSpan={5}
                      >
                        Nenhum abastecimento no período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Ranking de maior gasto</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Veículos com maior custo de combustível no período filtrado.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-72">
              {rankingCostData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={rankingCostData}
                    layout="vertical"
                    margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid stroke="#e5e7eb" horizontal={false} />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `R$ ${Number(value) / 1000}k`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      width={70}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value) => [formatCurrency(Number(value)), "Custo"]}
                      labelFormatter={(label) => `Veículo ${label}`}
                    />
                    <Bar dataKey="totalCost" radius={[0, 6, 6, 0]}>
                      {rankingCostData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  Sem abastecimentos no período.
                </div>
              )}
            </div>
            <div className="max-h-[168px] space-y-2 overflow-y-auto pr-1">
              {data.topFuelCostVehicles.slice(0, 5).map((vehicle, index) => (
                <div
                  key={vehicle.vehicleId}
                  className="rounded-lg border border-fleet-line p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <VehicleTypeIcon type={vehicle.type} />
                      <div>
                        <strong className="block text-sm">
                          {index + 1}. {vehicle.plate}
                        </strong>
                        <span className="text-xs text-zinc-500">
                          {vehicle.label}
                        </span>
                      </div>
                    </div>
                    <Badge
                      tone={index === 0 ? "red" : index < 3 ? "amber" : "cyan"}
                    >
                      {formatCurrency(vehicle.totalCost)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600">
                    {vehicle.totalLiters.toLocaleString("pt-BR")} L em{" "}
                    {vehicle.records} lançamentos
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_0.85fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-fleet-line bg-zinc-50/70">
            <div>
              <CardTitle>Ranking de km/L médio</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Km/L calculado a partir do odômetro inicial no primeiro
                abastecimento e, depois, pela sequência dos abastecimentos.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {efficiencyRanking.slice(0, 6).map((vehicle, index) => (
              <div
                key={vehicle.vehicleId}
                className="rounded-lg border border-fleet-line p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <VehicleTypeIcon type={vehicle.type} />
                    <div className="min-w-0">
                      <strong className="block truncate text-sm">
                        {index + 1}. {vehicle.plate}
                      </strong>
                      <span className="block truncate text-xs text-zinc-500">
                        {vehicle.label}
                      </span>
                    </div>
                  </div>
                  <Badge tone="green">
                    {vehicle.averageKmPerLiter
                      ? `${vehicle.averageKmPerLiter.toLocaleString("pt-BR", {
                          maximumFractionDigits: 2,
                        })} km/L`
                      : "Sem base"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  {Number(vehicle.distanceKm ?? 0).toLocaleString("pt-BR")} km
                  analisados com{" "}
                  {Number(vehicle.efficiencyLiters ?? 0).toLocaleString(
                    "pt-BR",
                  )}{" "}
                  L vinculados ao consumo.
                </p>
              </div>
            ))}
            {efficiencyRanking.length === 0 && (
              <p className="text-sm text-zinc-500">
                Sem abastecimentos no período.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {data.recentAlerts.map((alert) => (
                <div
                  key={alert._id}
                  className="rounded-lg border border-fleet-line p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
                        <AlertTriangle size={18} />
                      </span>
                      <div>
                        <strong className="block text-sm">
                          {alertTypeLabels[alert.type] ?? labelFor(alert.type)}
                        </strong>
                        <span className="text-xs text-zinc-500">
                          {formatDate(alert.triggeredAt)} •{" "}
                          {labelFor(alert.severity, severityLabels)}
                        </span>
                      </div>
                    </div>
                    <Badge tone={alert.severity === "critical" ? "red" : alert.severity === "warning" ? "amber" : "cyan"}>
                      {labelFor(alert.status)}
                    </Badge>
                  </div>
                </div>
              ))}
              {data.recentAlerts.length === 0 && (
                <p className="text-sm text-zinc-500">
                  Nenhum alerta recente aberto.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Manutenção próxima</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {data.upcomingMaintenance.map((order) => (
                <div
                  key={order._id}
                  className="rounded-lg border border-fleet-line p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                        <Wrench size={18} />
                      </span>
                      <div>
                        <strong className="block text-sm">
                          {labelFor(order.type, maintenanceTypeLabels)}
                        </strong>
                        <span className="text-xs text-zinc-500">
                          {order.scheduledAt
                            ? formatDate(order.scheduledAt)
                            : "Sem agendamento"}{" "}
                          • {labelFor(order.priority, priorityLabels)}
                        </span>
                      </div>
                    </div>
                    <Badge tone={order.status === "scheduled" ? "cyan" : "amber"}>
                      {labelFor(order.status)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600">
                    Custo previsto: {formatCurrency(Number(order.totalCost ?? 0))}
                  </p>
                </div>
              ))}
              {data.upcomingMaintenance.length === 0 && (
                <p className="text-sm text-zinc-500">
                  Nenhuma manutenção agendada para os próximos 30 dias.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
