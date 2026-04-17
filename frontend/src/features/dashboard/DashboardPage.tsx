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
import { StatCard } from "../../components/ui/stat-card";
import { VehicleTypeIcon } from "../../components/vehicle-type-icon";
import { getDashboard } from "../../lib/api";
import { labelFor, maintenanceTypeLabels, severityLabels } from "../../lib/labels";

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

const fuelTypeColors = ["#0f8f63", "#027f9f", "#b7791f", "#c2413b", "#3b82f6", "#71717a"];

function safeNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
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

  const hasDailyData = costByDay.some((point) => Number(point.total) > 0 || Number(point.liters) > 0);
  const totalOperationalCost =
    data.kpis.totalOperationalCost ??
    safeNumber(data.kpis.totalFuelCost) + safeNumber(data.kpis.totalMaintenanceCost) + safeNumber(data.kpis.totalExpenseCost);
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
            Visao executiva
          </span>
          <h2 className="text-2xl font-semibold text-fleet-ink">Dashboard operacional</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            Filtre o período para analisar abastecimento, consumo e custos por
            veículo.
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
          label="Veículos"
          value={String(data.kpis.totalVehicles)}
          detail="Ativos no tenant"
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
          detail={`${totalFuelLiters.toLocaleString("pt-BR")} L no periodo`}
          icon={Fuel}
          tone="cyan"
        />
        <StatCard
          label="Manutenção"
          value={formatCurrency(totalMaintenanceCost)}
          detail="Ordens no periodo"
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

      <section className="grid gap-6 xl:grid-cols-[1.45fr_1.1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-fleet-line bg-zinc-50/70">
            <div>
              <CardTitle>Custos e consumo por dia</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Custo operacional total e litros abastecidos no periodo selecionado
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">Custo total</Badge>
              <Badge tone="cyan">Litros</Badge>
              <Badge tone="amber">Atualização 30s</Badge>
            </div>
          </CardHeader>
          <CardContent className="h-96 bg-white">
            {hasDailyData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={costByDay} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                  <defs>
                    <linearGradient id="cost" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#0f8f63" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#0f8f63" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" vertical={false} />
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
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value, name) =>
                      name === "Litros" ? `${Number(value).toLocaleString("pt-BR")} L` : formatCurrency(Number(value))
                    }
                  />
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
                Nenhum custo ou abastecimento encontrado no periodo selecionado.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-fleet-line bg-zinc-50/70">
            <div>
              <CardTitle>Histórico 12 meses</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Custo total mensal independente do filtro
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">Custo total</Badge>
              <Badge tone="cyan">Litros</Badge>
            </div>
          </CardHeader>
          <CardContent className="h-96 bg-white">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costByMonth.slice(-12)} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="month-cost" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" vertical={false} />
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
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value, name) =>
                    name === "Litros" ? `${Number(value).toLocaleString("pt-BR")} L` : formatCurrency(Number(value))
                  }
                />
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

      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-fleet-line bg-zinc-50/70">
            <div>
              <CardTitle>Combustível por tipo</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Valor em reais e total de litros no periodo selecionado.
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
                  Nenhum abastecimento no periodo selecionado.
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
                    {item.liters.toLocaleString("pt-BR")} L em {item.records} lancamento(s)
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-fleet-line bg-zinc-50/70">
            <div>
              <CardTitle>Consumo médio por carro</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Km/L calculado pela diferenca entre abastecimentos consecutivos.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {data.fuelByVehicle.slice(0, 6).map((vehicle) => (
              <div
                key={vehicle.vehicleId}
                className="rounded-lg border border-fleet-line p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <VehicleTypeIcon type={vehicle.type} />
                    <div className="min-w-0">
                      <strong className="block truncate text-sm">
                        {vehicle.plate}
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
                  {Number(vehicle.distanceKm ?? 0).toLocaleString("pt-BR")} km analisados com{" "}
                  {Number(vehicle.efficiencyLiters ?? 0).toLocaleString("pt-BR")} L vinculados ao consumo.
                </p>
              </div>
            ))}
            {data.fuelByVehicle.length === 0 && (
              <p className="text-sm text-zinc-500">
                Sem abastecimentos no periodo.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.35fr_0.75fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Status operacional</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Distribuicao atual da frota
              </p>
            </div>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.vehiclesByStatus}>
                <CartesianGrid stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="_id"
                  tickFormatter={(value) =>
                    statusLabels[String(value)] ?? String(value)
                  }
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  labelFormatter={(value) =>
                    statusLabels[String(value)] ?? String(value)
                  }
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {data.vehiclesByStatus.map((entry) => (
                    <Cell
                      key={entry._id}
                      fill={statusColors[entry._id] ?? "#71717a"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Custo e consumo por carro</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Total de litros e valor abastecido dentro do período filtrado.
              </p>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
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
                      {vehicle.averageKmPerLiter ? `${vehicle.averageKmPerLiter.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km/L` : "-"}
                    </td>
                    <td className="border-b border-zinc-100 px-4 py-3">
                      {vehicle.records}
                    </td>
                  </tr>
                ))}
                {data.fuelByVehicle.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-zinc-500" colSpan={5}>
                      Nenhum abastecimento no período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranking de maior gasto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topFuelCostVehicles.map((vehicle, index) => (
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
            {data.topFuelCostVehicles.length === 0 && (
              <p className="text-sm text-zinc-500">
                Sem abastecimentos no período.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Alertas recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentAlerts.map((alert) => (
              <div
                key={alert._id}
                className="rounded-lg border border-fleet-line p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm">
                    {alert.type.replace(/_/g, " ")}
                  </strong>
                  <Badge
                    tone={
                      alert.severity === "critical"
                        ? "red"
                        : alert.severity === "warning"
                          ? "amber"
                          : "cyan"
                    }
                  >
                    {labelFor(alert.severity, severityLabels)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {formatDate(alert.triggeredAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manutenção próxima</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.upcomingMaintenance.map((order) => (
              <div
                key={order._id}
                className="rounded-lg border border-fleet-line p-3"
              >
                <div className="flex items-center gap-2">
                  <Wrench size={16} className="text-fleet-amber" />
                  <strong className="text-sm">
                    {labelFor(order.type, maintenanceTypeLabels)}
                  </strong>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  {formatDate(order.scheduledAt)}
                </p>
                <span className="mt-2 block text-sm font-medium">
                  {formatCurrency(order.totalCost)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custos acumulados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-fleet-line p-4">
              <span className="text-sm text-zinc-600">Total operacional</span>
              <strong className="mt-2 block text-2xl">
                {formatCurrency(totalOperationalCost)}
              </strong>
            </div>
            <div className="rounded-lg border border-fleet-line p-4">
              <div className="flex items-center gap-2 text-zinc-600">
                <Fuel size={18} className="text-fleet-green" />
                <span className="text-sm">Combustível</span>
              </div>
              <strong className="mt-2 block text-2xl">
                {formatCurrency(totalFuelCost)}
              </strong>
            </div>
            <div className="rounded-lg border border-fleet-line p-4">
              <span className="text-sm text-zinc-600">Litros registrados</span>
              <strong className="mt-2 block text-2xl">
                {totalFuelLiters.toLocaleString("pt-BR")} L
              </strong>
            </div>
            <div className="rounded-lg border border-fleet-line p-4">
              <span className="text-sm text-zinc-600">Manutenção</span>
              <strong className="mt-2 block text-2xl">
                {formatCurrency(totalMaintenanceCost)}
              </strong>
            </div>
            <div className="rounded-lg border border-fleet-line p-4">
              <span className="text-sm text-zinc-600">Outras despesas</span>
              <strong className="mt-2 block text-2xl">
                {formatCurrency(totalExpenseCost)}
              </strong>
            </div>
            <div className="rounded-lg border border-fleet-line p-4">
              <span className="text-sm text-zinc-600">
                Preço médio por litro
              </span>
              <strong className="mt-2 block text-2xl">
                {formatCurrency(averageFuelCost)}
              </strong>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
