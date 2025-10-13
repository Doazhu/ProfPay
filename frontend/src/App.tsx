import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import PayersPage from './PayersPage';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<div className="p-6"><h1 className="text-2xl font-semibold text-gray-900">Главная страница</h1><p className="text-gray-600 mt-2">Добро пожаловать в систему управления плательщиками</p></div>} />
          <Route path="/payers" element={<PayersPage />} />
          <Route path="/reports" element={<div className="p-6"><h1 className="text-2xl font-semibold text-gray-900">Отчёты</h1><p className="text-gray-600 mt-2">Раздел в разработке</p></div>} />
          <Route path="/notifications" element={<div className="p-6"><h1 className="text-2xl font-semibold text-gray-900">Уведомления</h1><p className="text-gray-600 mt-2">Раздел в разработке</p></div>} />
          <Route path="/settings" element={<div className="p-6"><h1 className="text-2xl font-semibold text-gray-900">Настройки</h1><p className="text-gray-600 mt-2">Раздел в разработке</p></div>} />
          <Route path="*" element={<div className="p-6"><h1 className="text-2xl font-semibold text-gray-900">Страница не найдена</h1><p className="text-gray-600 mt-2">Запрашиваемая страница не существует</p></div>} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
