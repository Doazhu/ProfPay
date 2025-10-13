import React from 'react';
import { useNavigate } from 'react-router-dom';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  // Mock statistics data - in real app this would come from API
  const stats = {
    totalPayers: 156,
    paidThisMonth: 142,
    pendingPayments: 14,
    totalRevenue: 234000,
    averagePayment: 1500,
    paymentRate: 91.0
  };

  const quickActions = [
    {
      title: 'Управление плательщиками',
      description: 'Просмотр и редактирование списка плательщиков',
      icon: '👥',
      path: '/payers',
      color: 'bg-blue-500'
    },
    {
      title: 'Отчёты',
      description: 'Аналитика и статистика платежей',
      icon: '📊',
      path: '/reports',
      color: 'bg-green-500'
    },
    {
      title: 'Уведомления',
      description: 'Настройка и отправка уведомлений',
      icon: '🔔',
      path: '/notifications',
      color: 'bg-yellow-500'
    },
    {
      title: 'Настройки',
      description: 'Конфигурация системы',
      icon: '⚙️',
      path: '/settings',
      color: 'bg-purple-500'
    }
  ];

  const recentActivity = [
    {
      id: 1,
      type: 'payment',
      message: 'Иванов И.И. внёс платёж 1500 ₽',
      time: '2 часа назад',
      icon: '💰'
    },
    {
      id: 2,
      type: 'reminder',
      message: 'Отправлено 5 напоминаний о платеже',
      time: '4 часа назад',
      icon: '📧'
    },
    {
      id: 3,
      type: 'user',
      message: 'Добавлен новый плательщик: Петрова А.С.',
      time: '1 день назад',
      icon: '👤'
    }
  ];

  const handleQuickAction = (path: string) => {
    navigate(path);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">
          Добро пожаловать в ProfPay
        </h1>
        <p className="text-gray-600">
          Система управления плательщиками и контроля платежей
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-custom shadow-soft p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Всего плательщиков</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalPayers}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-custom">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-custom shadow-soft p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Оплачено в этом месяце</p>
              <p className="text-2xl font-semibold text-green-600">{stats.paidThisMonth}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-custom">
              <span className="text-2xl">✅</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-custom shadow-soft p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ожидают оплаты</p>
              <p className="text-2xl font-semibold text-orange-600">{stats.pendingPayments}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-custom">
              <span className="text-2xl">⏳</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-custom shadow-soft p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Общий доход</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.totalRevenue.toLocaleString('ru-RU')} ₽
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-custom">
              <span className="text-2xl">💰</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-custom shadow-soft p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Средний платёж</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.averagePayment.toLocaleString('ru-RU')} ₽
              </p>
            </div>
            <div className="bg-indigo-100 p-3 rounded-custom">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-custom shadow-soft p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Процент оплат</p>
              <p className="text-2xl font-semibold text-green-600">{stats.paymentRate}%</p>
            </div>
            <div className="bg-green-100 p-3 rounded-custom">
              <span className="text-2xl">📈</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-custom shadow-soft p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Быстрые действия</h2>
          <div className="space-y-3">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleQuickAction(action.path)}
                className="w-full flex items-center p-4 rounded-custom border border-gray-200 hover:border-accent-solid hover:shadow-hover transition-all duration-200 text-left"
              >
                <div className={`${action.color} p-3 rounded-custom text-white mr-4`}>
                  <span className="text-xl">{action.icon}</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{action.title}</h3>
                  <p className="text-sm text-gray-600">{action.description}</p>
                </div>
                <div className="text-gray-400">
                  <span className="text-lg">→</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-custom shadow-soft p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Последняя активность</h2>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className="bg-gray-100 p-2 rounded-custom">
                  <span className="text-lg">{activity.icon}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button 
              onClick={() => navigate('/payers')}
              className="text-sm text-accent-solid hover:text-primary-solid transition-colors duration-200"
            >
              Посмотреть всю активность →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;