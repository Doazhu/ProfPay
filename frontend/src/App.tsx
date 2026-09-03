import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Theme } from '@radix-ui/themes';

import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import TotpGate from './components/TotpGate';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PayersPage from './pages/PayersPage';
import PayerDetailPage from './pages/PayerDetailPage';
import DebtorsPage from './pages/DebtorsPage';
import AddPayerPage from './pages/AddPayerPage';
import ChangePasswordPage from './pages/ChangePasswordPage';

// Редкие страницы грузятся отдельными кусками: бухгалтер открывает список
// плательщиков десятки раз за день, а отчёты и журнал — раз в месяц.
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const AuditPage = lazy(() => import('./pages/AuditPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

/** Пока подгружается отложенная страница. */
function PageFallback() {
  return <div className="spinner-container"><div className="spinner w-8 h-8" /></div>;
}

/**
 * Тема Radix. Вынесена в отдельный компонент, потому что читает выбранное
 * оформление из контекста, а провайдер контекста должен быть снаружи.
 */
function ThemedApp({ children }: { children: React.ReactNode }) {
  const { resolvedAppearance } = useTheme();

  return (
    <Theme
      appearance={resolvedAppearance}
      accentColor="grass"     // фирменный зелёный
      grayColor="sage"        // серый с зелёным подтоном — под акцент
      radius="large"
      scaling="95%"           // плотнее: это таблица учёта, а не лендинг
      panelBackground="solid"
    >
      {children}
    </Theme>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <ErrorBoundary>
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    {/* Открытая страница ровно одна: восстановление пароля
                        по почте убрано в пользу второго фактора. */}
                    <Route path="/login" element={<LoginPage />} />

                    {/* Всё остальное — только после входа */}
                    <Route
                      path="/"
                      element={(
                        <ProtectedRoute>
                          {/* Пока второй фактор обязателен, а у человека не
                              привязан, вместо разделов открывается привязка. */}
                          <TotpGate><Layout /></TotpGate>
                        </ProtectedRoute>
                      )}
                    >
                      <Route index element={<DashboardPage />} />
                      <Route path="payers" element={<PayersPage />} />
                      {/* Тот же список, открытый сразу на архиве выпускников */}
                      <Route path="archive" element={<PayersPage defaultArchive="archived" />} />
                      <Route path="payers/:id" element={<PayerDetailPage />} />
                      <Route path="debtors" element={<DebtorsPage />} />
                      <Route
                        path="add-payer"
                        element={<ProtectedRoute requiredRole="operator"><AddPayerPage /></ProtectedRoute>}
                      />
                      <Route path="reports" element={<ReportsPage />} />
                      <Route path="change-password" element={<ChangePasswordPage />} />
                      <Route
                        path="settings"
                        element={<ProtectedRoute requiredRole="admin"><SettingsPage /></ProtectedRoute>}
                      />
                      <Route
                        path="users"
                        element={<ProtectedRoute requiredRole="admin"><UsersPage /></ProtectedRoute>}
                      />
                      <Route
                        path="audit"
                        element={<ProtectedRoute requiredRole="admin"><AuditPage /></ProtectedRoute>}
                      />
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemedApp>
    </ThemeProvider>
  );
}
