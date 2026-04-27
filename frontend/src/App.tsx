import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ApiDocsPage } from './features/api-docs/ApiDocsPage';
import { AdminLayout } from './components/layout/AdminLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { CompliancePage } from './features/compliance/CompliancePage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { DriversPage } from './features/drivers/DriversPage';
import { FinancePage } from './features/finance/FinancePage';
import { FuelRecordsPage } from './features/fuel/FuelRecordsPage';
import { MaintenancePage } from './features/maintenance/MaintenancePage';
import { ReportsPage } from './features/reports/ReportsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { TrackingPage } from './features/tracking/TrackingPage';
import { VehiclesPage } from './features/vehicles/VehiclesPage';
import { ToastViewport } from './components/ui/toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 20_000
    }
  }
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/api-docs" element={<ApiDocsPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="vehicles" element={<VehiclesPage />} />
              <Route path="tracking" element={<TrackingPage />} />
              <Route path="drivers" element={<DriversPage />} />
              <Route path="maintenance" element={<MaintenancePage />} />
              <Route path="finance" element={<FinancePage />} />
              <Route path="fuel" element={<FuelRecordsPage />} />
              <Route path="compliance" element={<CompliancePage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastViewport />
    </QueryClientProvider>
  );
}
