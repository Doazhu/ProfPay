import { useEffect, useState } from 'react';
import type { DashboardStats, FacultyStats, MonthlyStats } from '../types';
import { statsApi } from '../services/api';

export default function ReportsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [facultyStats, setFacultyStats] = useState<FacultyStats[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadMonthlyStats();
  }, [selectedYear]);

  const loadStats = async () => {
    try {
      const [dashboard, byFaculty] = await Promise.all([
        statsApi.getDashboard(),
        statsApi.getByFaculty(),
      ]);
      setStats(dashboard);
      setFacultyStats(byFaculty);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMonthlyStats = async () => {
    try {
      const data = await statsApi.getMonthly(selectedYear);
      setMonthlyStats(data);
    } catch (error) {
      console.error('Failed to load monthly stats:', error);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatMoneyCompact = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}М ₽`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}К ₽`;
    }
    return formatMoney(amount);
  };

  const getMonthName = (monthStr: string) => {
    const months = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    const monthNum = parseInt(monthStr.split('-')[1]) - 1;
    return months[monthNum];
  };

  const getMonthNameShort = (monthStr: string) => {
    const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    const monthNum = parseInt(monthStr.split('-')[1]) - 1;
    return months[monthNum];
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
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-dark">Отчёты и статистика</h1>
        <p className="text-accent mt-1">Аналитика по плательщикам и платежам</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="card text-center">
          <p className="text-xs md:text-sm text-accent">Всего плательщиков</p>
          <p className="text-xl md:text-2xl lg:text-3xl font-bold text-dark mt-1 md:mt-2">{stats?.total_payers || 0}</p>
        </div>
        <div className="card text-center bg-green-50 border-green-200">
          <p className="text-xs md:text-sm text-green-600">Оплатили</p>
          <p className="text-xl md:text-2xl lg:text-3xl font-bold text-green-700 mt-1 md:mt-2">{stats?.paid_count || 0}</p>
          <p className="text-xs text-green-500 mt-1">
            {stats && stats.total_payers > 0
              ? `${((stats.paid_count / stats.total_payers) * 100).toFixed(1)}%`
              : '0%'}
          </p>
        </div>
        <div className="card text-center bg-red-50 border-red-200">
          <p className="text-xs md:text-sm text-red-600">Должники</p>
          <p className="text-xl md:text-2xl lg:text-3xl font-bold text-red-700 mt-1 md:mt-2">{stats?.total_debtors || 0}</p>
          <p className="text-xs text-red-500 mt-1">
            {stats && stats.total_payers > 0
              ? `${((stats.total_debtors / stats.total_payers) * 100).toFixed(1)}%`
              : '0%'}
          </p>
        </div>
        <div className="card text-center bg-primary/5 border-primary/20">
          <p className="text-xs md:text-sm text-primary">Собрано</p>
          <p className="text-lg md:text-xl lg:text-2xl font-bold text-primary mt-1 md:mt-2">
            {formatMoneyCompact(stats?.total_paid_amount || 0)}
          </p>
        </div>
      </div>

      {/* Faculty Stats */}
      <div className="card mb-6 md:mb-8">
        <h2 className="text-base md:text-lg font-semibold text-dark mb-4">Статистика по факультетам</h2>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-light-dark">
                <th className="text-left py-3 px-4 text-sm font-medium text-accent">Факультет</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-accent">Всего</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-accent">Оплатили</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-accent">Должники</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-accent">% оплаты</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-accent">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {facultyStats.map((faculty) => {
                const percentage = faculty.total_payers > 0
                  ? (faculty.paid_count / faculty.total_payers) * 100
                  : 0;
                return (
                  <tr key={faculty.faculty_id} className="border-b border-light-dark last:border-0 table-row-interactive">
                    <td className="py-3 px-4 text-dark font-medium">{faculty.faculty_name}</td>
                    <td className="py-3 px-4 text-right text-dark">{faculty.total_payers}</td>
                    <td className="py-3 px-4 text-right text-green-600">{faculty.paid_count}</td>
                    <td className="py-3 px-4 text-right text-red-600">{faculty.unpaid_count}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-light-dark rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-accent w-12 text-right">
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-dark font-medium">
                      {formatMoney(faculty.total_amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {facultyStats.map((faculty) => {
            const percentage = faculty.total_payers > 0
              ? (faculty.paid_count / faculty.total_payers) * 100
              : 0;
            return (
              <div key={faculty.faculty_id} className="p-3 bg-light-dark/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-dark">{faculty.faculty_name}</p>
                  <span className="text-sm font-medium text-primary">{formatMoneyCompact(faculty.total_amount)}</span>
                </div>
                {/* Progress bar */}
                <div className="mb-2">
                  <div className="w-full bg-light-dark rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-accent">Всего: {faculty.total_payers}</span>
                  <span className="text-green-600">Оплат: {faculty.paid_count}</span>
                  <span className="text-red-600">Долг: {faculty.unpaid_count}</span>
                  <span className="text-accent">{percentage.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Stats */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-base md:text-lg font-semibold text-dark">Помесячная статистика платежей</h2>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="input w-full sm:w-32"
          >
            {[2024, 2023, 2022].map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        {monthlyStats.length === 0 ? (
          <p className="text-center text-accent py-8">
            Нет данных за {selectedYear} год
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-light-dark">
                    <th className="text-left py-3 px-4 text-sm font-medium text-accent">Месяц</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-accent">Платежей</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-accent">Сумма</th>
                    <th className="py-3 px-4 text-sm font-medium text-accent">График</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyStats.map((month) => {
                    const maxAmount = Math.max(...monthlyStats.map(m => m.total_amount));
                    const barWidth = maxAmount > 0 ? (month.total_amount / maxAmount) * 100 : 0;
                    return (
                      <tr key={month.month} className="border-b border-light-dark last:border-0">
                        <td className="py-3 px-4 text-dark">{getMonthName(month.month)}</td>
                        <td className="py-3 px-4 text-right text-accent">{month.payments_count}</td>
                        <td className="py-3 px-4 text-right text-dark font-medium">
                          {formatMoney(month.total_amount)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="w-full bg-light-dark rounded-full h-4 overflow-hidden">
                            <div
                              className="bg-secondary h-4 rounded-full transition-all duration-500 ease-out"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {monthlyStats.map((month) => {
                const maxAmount = Math.max(...monthlyStats.map(m => m.total_amount));
                const barWidth = maxAmount > 0 ? (month.total_amount / maxAmount) * 100 : 0;
                return (
                  <div key={month.month} className="p-3 bg-light-dark/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-dark">{getMonthNameShort(month.month)}</span>
                      <span className="text-sm text-accent">{month.payments_count} платежей</span>
                      <span className="font-medium text-dark">{formatMoneyCompact(month.total_amount)}</span>
                    </div>
                    <div className="w-full bg-light-dark rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-secondary h-3 rounded-full"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
