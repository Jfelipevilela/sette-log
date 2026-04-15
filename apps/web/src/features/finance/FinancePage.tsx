import { useQuery } from '@tanstack/react-query';
import { CreditCard, Download, Fuel, Receipt } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, Td, Th } from '../../components/ui/table';
import { getDashboard } from '../../lib/api';
import { mockDashboard, mockVehicles } from '../../lib/mock-data';
import { downloadTextFile, formatCurrency, toCsv } from '../../lib/utils';

export function FinancePage() {
  const { data = mockDashboard } = useQuery({
    queryKey: ['finance-dashboard'],
    queryFn: () => getDashboard().catch(() => mockDashboard)
  });

  const pieData = [
    { name: 'Combustivel', value: data.kpis.totalFuelCost, color: '#0f8f63' },
    { name: 'Manutencao e despesas', value: data.kpis.totalExpenseCost, color: '#027f9f' },
    { name: 'Multas e sinistros', value: 2380, color: '#c2413b' }
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Financeiro da frota</h2>
          <p className="mt-1 text-sm text-zinc-500">Abastecimentos, multas, seguros, impostos, pedagios e custo por km.</p>
        </div>
        <Button
          variant="secondary"
          onClick={() =>
            downloadTextFile(
              'financeiro-frota.csv',
              toCsv(
                mockVehicles.map((vehicle) => ({
                  placa: vehicle.plate,
                  centro_custo: vehicle.costCenter,
                  combustivel: vehicle.financialSummary?.totalFuelCost ?? 0,
                  despesas: vehicle.financialSummary?.totalExpenses ?? 0,
                  custo_km: vehicle.financialSummary?.costPerKm ?? 0
                }))
              )
            )
          }
        >
          <Download size={18} />
          Exportar CSV
        </Button>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <Fuel className="text-fleet-green" />
          <span className="mt-4 block text-sm text-zinc-500">Combustivel</span>
          <strong className="mt-2 block text-3xl">{formatCurrency(data.kpis.totalFuelCost)}</strong>
        </Card>
        <Card className="p-5">
          <Receipt className="text-fleet-cyan" />
          <span className="mt-4 block text-sm text-zinc-500">Despesas gerais</span>
          <strong className="mt-2 block text-3xl">{formatCurrency(data.kpis.totalExpenseCost)}</strong>
        </Card>
        <Card className="p-5">
          <CreditCard className="text-fleet-amber" />
          <span className="mt-4 block text-sm text-zinc-500">Preço médio litro</span>
          <strong className="mt-2 block text-3xl">{formatCurrency(data.kpis.averageFuelCost)}</strong>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Distribuicao de custos</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={3}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custo por veiculo</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Placa</Th>
                  <Th>Centro de custo</Th>
                  <Th>Combustivel</Th>
                  <Th>Despesas</Th>
                  <Th>Custo/km</Th>
                </tr>
              </thead>
              <tbody>
                {mockVehicles.map((vehicle) => (
                  <tr key={vehicle._id}>
                    <Td>
                      <strong>{vehicle.plate}</strong>
                    </Td>
                    <Td>{vehicle.costCenter}</Td>
                    <Td>{formatCurrency(vehicle.financialSummary?.totalFuelCost ?? 0)}</Td>
                    <Td>{formatCurrency(vehicle.financialSummary?.totalExpenses ?? 0)}</Td>
                    <Td>
                      <Badge tone="cyan">{formatCurrency(vehicle.financialSummary?.costPerKm ?? 0)}</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
