import { useState } from 'react';
import { Download, FileSpreadsheet, LineChart, SlidersHorizontal } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { getDashboard, getDrivers, getVehicles } from '../../lib/api';
import { downloadTextFile, toCsv } from '../../lib/utils';

export function ReportsPage() {
  const [filterMessage, setFilterMessage] = useState('Periodo padrao carregado.');
  const { data: dashboard = {
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
      averageFuelCost: 0
    },
    vehiclesByStatus: [],
    criticalVehicles: [],
    upcomingMaintenance: [],
    expiringDocuments: [],
    costByMonth: [],
    fuelByVehicle: [],
    topFuelCostVehicles: [],
    dashboardPeriod: {
      from: new Date().toISOString(),
      to: new Date().toISOString()
    },
    recentAlerts: [],
    generatedAt: new Date().toISOString()
  } } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => getDashboard()
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => getVehicles()
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => getDrivers()
  });
  const utilization = vehicles.map((vehicle, index) => ({
    plate: vehicle.plate,
    utilization: vehicle.status === 'inactive' || vehicle.status === 'blocked' ? 0 : 100,
    score: drivers[index]?.score ?? 0
  }));

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Analytics e BI</h2>
          <p className="mt-1 text-sm text-zinc-500">KPIs, comparativos por periodo e exportacoes para analise executiva.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            <Download size={18} />
            PDF
          </Button>
          <Button
            variant="secondary"
            onClick={() => downloadTextFile('relatório-bi.csv', toCsv(utilization))}
          >
            <FileSpreadsheet size={18} />
            Excel
          </Button>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Filtros de relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[180px_180px_1fr_auto]">
            <Input type="date" id="report-from" />
            <Input type="date" id="report-to" />
            <Input id="report-scope" placeholder="Operação, filial ou centro de custo" />
            <Button onClick={() => setFilterMessage('Filtros aplicados ao painel atual.')}>
              <SlidersHorizontal size={18} />
              Aplicar
            </Button>
          </div>
          <p className="mt-3 text-sm text-zinc-500">{filterMessage}</p>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Utilização e score</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">Comparativo por veículo com indicador do motorista principal.</p>
            </div>
          </CardHeader>
          <CardContent className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilization}>
                <CartesianGrid stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="plate" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="utilization" fill="#027f9f" name="Utilização" radius={[6, 6, 0, 0]} />
                <Bar dataKey="score" fill="#0f8f63" name="Score" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Base preditiva</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-fleet-line p-4">
              <LineChart className="text-fleet-green" />
              <strong className="mt-3 block">Manutenção preditiva</strong>
              <p className="mt-1 text-sm text-zinc-500">Telemetria histórica, odômetro, custos e falhas alimentam modelos futuros.</p>
            </div>
            <div className="relative overflow-hidden rounded-lg border border-cyan-100 bg-white p-4 shadow-sm">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 to-cyan-300" />
              <strong className="block text-xs font-semibold uppercase text-zinc-500">Disponibilidade</strong>
              <span className="mt-2 block text-3xl font-semibold text-fleet-ink">{dashboard.kpis.availability}%</span>
              <p className="mt-2 text-sm text-zinc-500">Frota liberada para operação</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
