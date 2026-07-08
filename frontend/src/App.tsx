import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { WorkOrdersListPage } from './pages/WorkOrdersListPage';
import { WorkOrderDetailPage } from './pages/WorkOrderDetailPage';
import { NewWorkOrderPage } from './pages/NewWorkOrderPage';
import { InventoryPage } from './pages/InventoryPage';
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage';
import { BillingPage } from './pages/BillingPage';
import { ReportsPage } from './pages/ReportsPage';
import { ProjectTrackerPage } from './pages/ProjectTrackerPage';
import { TemplateImportPage } from './pages/TemplateImportPage';
import { ClientBillingPage } from './pages/ClientBillingPage';
import { AddClientPage } from './pages/AddClientPage';
import { AddCompanyPage } from './pages/AddCompanyPage';
import { AdminPaymentDashboardPage } from './pages/AdminPaymentDashboardPage';

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
      <ToastProvider>
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
              path="/my-billing"
              element={
                <RoleGuard roles={['client']}>
                  <ClientBillingPage />
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
              path="/purchase-orders"
              element={
                <RoleGuard roles={['staff', 'admin']}>
                  <PurchaseOrdersPage />
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
              path="/add-client"
              element={
                <RoleGuard roles={['admin']}>
                  <AddClientPage />
                </RoleGuard>
              }
            />
            <Route
              path="/add-company"
              element={
                <RoleGuard roles={['admin']}>
                  <AddCompanyPage />
                </RoleGuard>
              }
            />
            <Route
              path="/admin-payments"
              element={
                <RoleGuard roles={['admin']}>
                  <AdminPaymentDashboardPage />
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
            <Route
              path="/templates/import"
              element={
                <RoleGuard roles={['staff', 'admin']}>
                  <TemplateImportPage />
                </RoleGuard>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
