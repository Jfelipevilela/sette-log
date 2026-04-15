import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/auth-store';

export function ProtectedRoute() {
  const accessToken = useAuthStore((state) => state.accessToken);
  return accessToken ? <Outlet /> : <Navigate to="/login" replace />;
}
