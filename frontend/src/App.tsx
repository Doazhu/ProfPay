import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PayersPage from './pages/PayersPage';
import PayerDetailPage from './pages/PayerDetailPage';
import DebtorsPage from './pages/DebtorsPage';
import AddPayerPage from './pages/AddPayerPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="payers" element={<PayersPage />} />
              <Route path="payers/:id" element={<PayerDetailPage />} />
              <Route path="debtors" element={<DebtorsPage />} />
              <Route
                path="add-payer"
                element={
                  <ProtectedRoute requiredRole="operator">
                    <AddPayerPage />
                  </ProtectedRoute>
                }
              />
              <Route path="reports" element={<ReportsPage />} />
              <Route
                path="settings"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
