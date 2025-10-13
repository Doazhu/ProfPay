import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import PayersPage from './PayersPage';
import HomePage from './HomePage';
import ReportsPage from './ReportsPage';
import NotificationsPage from './NotificationsPage';
import SettingsPage from './SettingsPage';
import NotFoundPage from './NotFoundPage';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Layout>
          <ErrorBoundary fallback={
            <div className="p-6 text-center">
              <h2 className="text-xl font-semibold text-red-600 mb-2">Ошибка навигации</h2>
              <p className="text-gray-600">Произошла ошибка при загрузке страницы. Попробуйте обновить браузер.</p>
            </div>
          }>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/payers" element={<PayersPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ErrorBoundary>
        </Layout>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
