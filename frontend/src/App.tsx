import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { WorkOrdersListPage } from './pages/WorkOrdersListPage';
import { WorkOrderDetailPage } from './pages/WorkOrderDetailPage';
import { NewWorkOrderPage } from './pages/NewWorkOrderPage';
import { InventoryPage } from './pages/InventoryPage';
import { BillingPage } from './pages/BillingPage';
import { ReportsPage } from './pages/ReportsPage';
import { ProjectTrackerPage } from './pages/ProjectTrackerPage';

function ProtectedRoutes({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleGuard({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/work-orders" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <ProtectedRoutes>
                <AppShell />
              </ProtectedRoutes>
            }
          >
            <Route path="/" element={<Navigate to="/work-orders" replace />} />
            <Route path="/work-orders" element={<WorkOrdersListPage />} />
            <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
            <Route
              path="/work-orders/new"
              element={
                <RoleGuard roles={['client']}>
                  <NewWorkOrderPage />
                </RoleGuard>
              }
            />
            <Route
              path="/inventory"
              element={
                <RoleGuard roles={['staff', 'admin']}>
                  <InventoryPage />
                </RoleGuard>
              }
            />
            <Route
              path="/billing"
              element={
                <RoleGuard roles={['staff', 'admin']}>
                  <BillingPage />
                </RoleGuard>
              }
            />
            <Route
              path="/reports"
              element={
                <RoleGuard roles={['admin']}>
                  <ReportsPage />
                </RoleGuard>
              }
            />
            <Route
              path="/project-trackers"
              element={
                <RoleGuard roles={['staff', 'admin']}>
                  <ProjectTrackerPage />
                </RoleGuard>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
