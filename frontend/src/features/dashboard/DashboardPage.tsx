import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Car,
  Fuel,
  Gauge,
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
import { getDashboard } from "../../lib/api";

import { formatCurrency, formatDate, formatPercent } from "../../lib/utils";

const statusLabels: Record<string, string> = {
  available: "Disponivel",
  in_route: "Em rota",
  stopped: "Parado",
  maintenance: "Manutencao",
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

export function DashboardPage() {
  const today = new Date().toISOString().slice(0, 10);
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(firstDayOfMonth);
  const [to, setTo] = useState(today);
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
        totalExpenseCost: 0,
        averageFuelCost: 0,
      },
      vehiclesByStatus: [],
      criticalVehicles: [],
      upcomingMaintenance: [],
      expiringDocuments: [],
      costByMonth: [],
      fuelByVehicle: [],
      topFuelCostVehicles: [],
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

  const costByMonth = data.costByMonth.map((point) => ({
    month: `${String(point._id.month).padStart(2, "0")}/${point._id.year}`,
    total: point.total,
    liters: point.liters,
  }));

  if (isLoading) {
    return <LoadingState label="Carregando dashboard..." />;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 rounded-lg border border-fleet-line bg-white p-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-xl font-semibold">Dashboard operacional</h2>
          <p className="mt-1 text-sm text-zinc-500">Filtre o período para analisar abastecimento, consumo e custos por veículo.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium">
            De
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="space-y-2 text-sm font-medium">
            Até
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Veiculos"
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

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Custos e consumo</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Base mensal de abastecimento e litros registrados
              </p>
            </div>
            <Badge tone="green">Atualizacao 30s</Badge>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costByMonth}>
                <defs>
                  <linearGradient id="cost" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#0f8f63" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#0f8f63" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `R$ ${Number(value) / 1000}k`}
                />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#0f8f63"
                  strokeWidth={3}
                  fill="url(#cost)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

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
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Custo e consumo por carro</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">Total de litros e valor abastecido dentro do período filtrado.</p>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b border-fleet-line px-4 py-3 font-semibold text-zinc-600">Veículo</th>
                  <th className="border-b border-fleet-line px-4 py-3 font-semibold text-zinc-600">Litros</th>
                  <th className="border-b border-fleet-line px-4 py-3 font-semibold text-zinc-600">Custo</th>
                  <th className="border-b border-fleet-line px-4 py-3 font-semibold text-zinc-600">Média/L</th>
                  <th className="border-b border-fleet-line px-4 py-3 font-semibold text-zinc-600">Lançamentos</th>
                </tr>
              </thead>
              <tbody>
                {data.fuelByVehicle.map((vehicle) => (
                  <tr key={vehicle.vehicleId}>
                    <td className="border-b border-zinc-100 px-4 py-3">
                      <strong>{vehicle.plate}</strong>
                      <span className="block text-xs text-zinc-500">{vehicle.label}</span>
                    </td>
                    <td className="border-b border-zinc-100 px-4 py-3">{vehicle.totalLiters.toLocaleString("pt-BR")} L</td>
                    <td className="border-b border-zinc-100 px-4 py-3">{formatCurrency(vehicle.totalCost)}</td>
                    <td className="border-b border-zinc-100 px-4 py-3">{formatCurrency(vehicle.averagePrice)}</td>
                    <td className="border-b border-zinc-100 px-4 py-3">{vehicle.records}</td>
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
              <div key={vehicle.vehicleId} className="rounded-lg border border-fleet-line p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <strong className="block text-sm">
                      {index + 1}. {vehicle.plate}
                    </strong>
                    <span className="text-xs text-zinc-500">{vehicle.label}</span>
                  </div>
                  <Badge tone={index === 0 ? "red" : index < 3 ? "amber" : "cyan"}>{formatCurrency(vehicle.totalCost)}</Badge>
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  {vehicle.totalLiters.toLocaleString("pt-BR")} L em {vehicle.records} lançamentos
                </p>
              </div>
            ))}
            {data.topFuelCostVehicles.length === 0 && <p className="text-sm text-zinc-500">Sem abastecimentos no período.</p>}
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
                    {alert.severity}
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
            <CardTitle>Manutencao proxima</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.upcomingMaintenance.map((order) => (
              <div
                key={order._id}
                className="rounded-lg border border-fleet-line p-3"
              >
                <div className="flex items-center gap-2">
                  <Wrench size={16} className="text-fleet-amber" />
                  <strong className="text-sm">{order.type}</strong>
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
            <CardTitle>Indicadores financeiros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-fleet-line p-4">
              <div className="flex items-center gap-2 text-zinc-600">
                <Fuel size={18} className="text-fleet-green" />
                <span className="text-sm">Combustivel acumulado</span>
              </div>
              <strong className="mt-2 block text-2xl">
                {formatCurrency(data.kpis.totalFuelCost)}
              </strong>
            </div>
            <div className="rounded-lg border border-fleet-line p-4">
              <span className="text-sm text-zinc-600">Litros registrados</span>
              <strong className="mt-2 block text-2xl">
                {data.kpis.totalFuelLiters.toLocaleString("pt-BR")} L
              </strong>
            </div>
            <div className="rounded-lg border border-fleet-line p-4">
              <span className="text-sm text-zinc-600">
                Despesas operacionais
              </span>
              <strong className="mt-2 block text-2xl">
                {formatCurrency(data.kpis.totalExpenseCost)}
              </strong>
            </div>
            <div className="rounded-lg border border-fleet-line p-4">
              <span className="text-sm text-zinc-600">
                Preço médio por litro
              </span>
              <strong className="mt-2 block text-2xl">
                {formatCurrency(data.kpis.averageFuelCost)}
              </strong>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
