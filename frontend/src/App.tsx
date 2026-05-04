import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ApiDocsPage } from './features/api-docs/ApiDocsPage';
import { AdminLayout } from './components/layout/AdminLayout';
import { PermissionRoute } from './components/layout/PermissionRoute';
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
import { refreshSession, getAccessTokenExpiry } from './lib/api';
import { PERMISSIONS } from './lib/permissions';
import { notify } from './lib/toast';
import { useAuthStore } from './store/auth-store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 20_000
    }
  }
});

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 30 * 1000;
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

function SessionManager() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const lastActivityAt = useAuthStore((state) => state.lastActivityAt);
  const touchActivity = useAuthStore((state) => state.touchActivity);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (!accessToken || !refreshToken) {
      return undefined;
    }

    let lastRecordedActivity = lastActivityAt ?? Date.now();

    const registerActivity = () => {
      const now = Date.now();
      if (now - lastRecordedActivity >= ACTIVITY_THROTTLE_MS) {
        lastRecordedActivity = now;
        touchActivity();
      }
    };

    const events: Array<keyof WindowEventMap> = [
      'click',
      'keydown',
      'mousemove',
      'scroll',
      'touchstart',
      'focus',
    ];

    events.forEach((eventName) =>
      window.addEventListener(eventName, registerActivity, { passive: true }),
    );

    const interval = window.setInterval(async () => {
      const currentActivityAt = useAuthStore.getState().lastActivityAt ?? Date.now();
      const now = Date.now();

      if (now - currentActivityAt >= IDLE_TIMEOUT_MS) {
        logout();
        notify({
          title: 'Sessão encerrada',
          description: 'Você ficou 1 hora sem atividade e foi desconectado.',
          tone: 'info',
        });
        if (window.location.pathname !== '/login') {
          window.history.replaceState(null, '', '/login');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
        return;
      }

      const expiresAt = getAccessTokenExpiry(useAuthStore.getState().accessToken);
      if (expiresAt && expiresAt - now <= REFRESH_THRESHOLD_MS) {
        try {
          await refreshSession();
        } catch {
          logout();
          if (window.location.pathname !== '/login') {
            window.history.replaceState(null, '', '/login');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        }
      }
    }, 60_000);

    return () => {
      events.forEach((eventName) =>
        window.removeEventListener(eventName, registerActivity),
      );
      window.clearInterval(interval);
    };
  }, [accessToken, refreshToken, lastActivityAt, logout, touchActivity]);

  return null;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionManager />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/api-docs" element={<ApiDocsPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route
                index
                element={
                  <PermissionRoute permissions={[PERMISSIONS.DASHBOARD_VIEW]}>
                    <DashboardPage />
                  </PermissionRoute>
                }
              />
              <Route
                path="vehicles"
                element={
                  <PermissionRoute permissions={[PERMISSIONS.VEHICLES_VIEW]}>
                    <VehiclesPage />
                  </PermissionRoute>
                }
              />
              <Route
                path="tracking"
                element={
                  <PermissionRoute permissions={[PERMISSIONS.TRACKING_VIEW]}>
                    <TrackingPage />
                  </PermissionRoute>
                }
              />
              <Route
                path="drivers"
                element={
                  <PermissionRoute permissions={[PERMISSIONS.DRIVERS_VIEW]}>
                    <DriversPage />
                  </PermissionRoute>
                }
              />
              <Route
                path="maintenance"
                element={
                  <PermissionRoute permissions={[PERMISSIONS.MAINTENANCE_VIEW]}>
                    <MaintenancePage />
                  </PermissionRoute>
                }
              />
              <Route
                path="finance"
                element={
                  <PermissionRoute permissions={[PERMISSIONS.FINANCE_VIEW]}>
                    <FinancePage />
                  </PermissionRoute>
                }
              />
              <Route
                path="fuel"
                element={
                  <PermissionRoute
                    permissions={[
                      PERMISSIONS.FINANCE_VIEW,
                      PERMISSIONS.FUEL_DRIVER_PORTAL_ACCESS,
                    ]}
                  >
                    <FuelRecordsPage />
                  </PermissionRoute>
                }
              />
              <Route
                path="compliance"
                element={
                  <PermissionRoute permissions={[PERMISSIONS.COMPLIANCE_VIEW]}>
                    <CompliancePage />
                  </PermissionRoute>
                }
              />
              <Route
                path="reports"
                element={
                  <PermissionRoute permissions={[PERMISSIONS.REPORTS_VIEW]}>
                    <ReportsPage />
                  </PermissionRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <PermissionRoute
                    permissions={[
                      PERMISSIONS.SETTINGS_MANAGE,
                      PERMISSIONS.USERS_MANAGE,
                      PERMISSIONS.INTEGRATIONS_MANAGE,
                    ]}
                  >
                    <SettingsPage />
                  </PermissionRoute>
                }
              />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastViewport />
    </QueryClientProvider>
  );
}
