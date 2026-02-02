import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardStats, FacultyStats } from '../types';
import { statsApi } from '../services/api';

// Stat Card Component
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger';
  icon: React.ReactNode;
}

function StatCard({ title, value, subtitle, color, icon }: StatCardProps) {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary/10 text-secondary',
    accent: 'bg-accent/10 text-accent',
    success: 'bg-green-100 text-green-600',
    warning: 'bg-yellow-100 text-yellow-600',
    danger: 'bg-red-100 text-red-600',
  };

  return (
    <div className="card-interactive">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs md:text-sm text-accent font-medium">{title}</p>
          <p className="text-xl md:text-2xl lg:text-3xl font-bold text-dark mt-1 md:mt-2 truncate">{value}</p>
          {subtitle && <p className="text-xs md:text-sm text-accent mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2 md:p-3 rounded-lg transition-transform duration-200 group-hover:scale-110 flex-shrink-0 ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// Icons
const UsersIcon = () => (
  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const MoneyIcon = () => (
  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AlertIcon = () => (
  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [facultyStats, setFacultyStats] = useState<FacultyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashboardData, facultyData] = await Promise.all([
        statsApi.getDashboard(),
        statsApi.getByFaculty(),
      ]);
      setStats(dashboardData);
      setFacultyStats(facultyData);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Compact money format for mobile
  const formatMoneyCompact = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}М ₽`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}К ₽`;
    }
    return formatMoney(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 animate-fade-in">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-dark">Панель управления</h1>
        <p className="text-accent mt-1">Обзор статистики по плательщикам</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
        <StatCard
          title="Всего плательщиков"
          value={stats?.total_payers || 0}
          color="primary"
          icon={<UsersIcon />}
        />
        <StatCard
          title="Собрано средств"
          value={formatMoneyCompact(stats?.total_paid_amount || 0)}
          color="success"
          icon={<MoneyIcon />}
        />
        <StatCard
          title="Оплатили"
          value={stats?.paid_count || 0}
          subtitle={`${stats?.partial_count || 0} частично`}
          color="secondary"
          icon={<CheckIcon />}
        />
        <StatCard
          title="Должники"
          value={stats?.total_debtors || 0}
          color="danger"
          icon={<AlertIcon />}
        />
      </div>

      {/* Faculty Stats */}
      <div className="card mb-6 md:mb-8">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h2 className="text-base md:text-lg font-semibold text-dark">Статистика по факультетам</h2>
          <Link to="/reports" className="text-sm text-primary hover:text-primary-dark active:text-primary-dark">
            Подробнее
          </Link>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-light-dark">
                <th className="text-left py-3 px-4 text-sm font-medium text-accent">Факультет</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-accent">Всего</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-accent">Оплатили</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-accent">Должники</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-accent">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {facultyStats.map((faculty) => (
                <tr key={faculty.faculty_id} className="border-b border-light-dark last:border-0 table-row-interactive">
                  <td className="py-3 px-4 text-dark">{faculty.faculty_name}</td>
                  <td className="py-3 px-4 text-right text-dark">{faculty.total_payers}</td>
                  <td className="py-3 px-4 text-right text-green-600">{faculty.paid_count}</td>
                  <td className="py-3 px-4 text-right text-red-600">{faculty.unpaid_count}</td>
                  <td className="py-3 px-4 text-right text-dark font-medium">
                    {formatMoney(faculty.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {facultyStats.map((faculty) => (
            <div key={faculty.faculty_id} className="p-3 bg-light-dark/30 rounded-lg">
              <p className="font-medium text-dark mb-2">{faculty.faculty_name}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-accent">Всего: </span>
                  <span className="text-dark">{faculty.total_payers}</span>
                </div>
                <div>
                  <span className="text-accent">Сумма: </span>
                  <span className="font-medium text-dark">{formatMoneyCompact(faculty.total_amount)}</span>
                </div>
                <div>
                  <span className="text-green-600">Оплатили: {faculty.paid_count}</span>
                </div>
                <div>
                  <span className="text-red-600">Должники: {faculty.unpaid_count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <Link
          to="/payers"
          className="card-interactive flex items-center gap-3 md:gap-4 group"
        >
          <div className="p-2 md:p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-200 flex-shrink-0">
            <UsersIcon />
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-dark">Все плательщики</h3>
            <p className="text-sm text-accent truncate">Просмотр и редактирование</p>
          </div>
        </Link>

        <Link
          to="/debtors"
          className="card-interactive flex items-center gap-3 md:gap-4 group"
        >
          <div className="p-2 md:p-3 rounded-lg bg-red-100 text-red-600 group-hover:bg-red-500 group-hover:text-white transition-all duration-200 flex-shrink-0">
            <AlertIcon />
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-dark">Список должников</h3>
            <p className="text-sm text-accent truncate">Неоплаченные взносы</p>
          </div>
        </Link>

        <Link
          to="/add-payer"
          className="card-interactive flex items-center gap-3 md:gap-4 group sm:col-span-2 md:col-span-1"
        >
          <div className="p-2 md:p-3 rounded-lg bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-white transition-all duration-200 flex-shrink-0">
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-dark">Добавить плательщика</h3>
            <p className="text-sm text-accent truncate">Регистрация нового члена</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
