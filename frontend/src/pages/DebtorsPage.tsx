import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Payer, Faculty, StudentGroup, PaymentStatus } from '../types';
import { payerApi, facultyApi, groupApi } from '../services/api';

// Status Badge Component
function StatusBadge({ status }: { status: PaymentStatus }) {
  const config = {
    paid: { label: 'Оплачено', className: 'badge-success' },
    partial: { label: 'Частично', className: 'badge-warning' },
    unpaid: { label: 'Не оплачено', className: 'badge-danger' },
    exempt: { label: 'Освобождён', className: 'badge-info' },
  };

  const { label, className } = config[status];
  return <span className={className}>{label}</span>;
}

export default function DebtorsPage() {
  const [debtors, setDebtors] = useState<Payer[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const [searchParams, setSearchParams] = useSearchParams();

  const page = parseInt(searchParams.get('page') || '1');
  const facultyId = searchParams.get('faculty') ? parseInt(searchParams.get('faculty')!) : undefined;

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadDebtors();
  }, [page, facultyId]);

  const loadFilters = async () => {
    try {
      const [facultyData, groupData] = await Promise.all([
        facultyApi.getAll(),
        groupApi.getAll(),
      ]);
      setFaculties(facultyData);
      setGroups(groupData);
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  };

  const loadDebtors = async () => {
    setIsLoading(true);
    try {
      const response = await payerApi.getDebtors({
        page,
        per_page: 20,
        faculty_id: facultyId,
      });
      setDebtors(response.items);
      setTotal(response.total);
      setPages(response.pages);
    } catch (error) {
      console.error('Failed to load debtors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateFilter = (key: string, value: string | undefined) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    if (key !== 'page') {
      newParams.delete('page');
    }
    setSearchParams(newParams);
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Get faculty/group names for display
  const getFacultyName = (id: number | null) => {
    if (!id) return '—';
    const faculty = faculties.find(f => f.id === id);
    return faculty?.short_name || faculty?.name || '—';
  };

  const getGroupName = (id: number | null) => {
    if (!id) return '';
    const group = groups.find(g => g.id === id);
    return group?.name || '';
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark flex items-center gap-2">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Должники
        </h1>
        <p className="text-accent mt-1">
          Плательщики с неоплаченными или частично оплаченными взносами: {total}
        </p>
      </div>

      {/* Filter */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm text-accent">Фильтр по факультету:</label>
          <select
            value={facultyId || ''}
            onChange={(e) => updateFilter('faculty', e.target.value)}
            className="input max-w-xs"
          >
            <option value="">Все факультеты</option>
            {faculties.map((f) => (
              <option key={f.id} value={f.id}>
                {f.short_name || f.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-red-100">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-red-600">Не оплачено</p>
              <p className="text-2xl font-bold text-red-700">
                {debtors.filter(d => d.status === 'unpaid').length}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-yellow-50 border-yellow-200">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-yellow-100">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-yellow-600">Частично оплачено</p>
              <p className="text-2xl font-bold text-yellow-700">
                {debtors.filter(d => d.status === 'partial').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 animate-fade-in">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : debtors.length === 0 ? (
          <div className="text-center py-12 animate-scale-in">
            <svg className="w-16 h-16 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-medium text-dark">Должников нет!</p>
            <p className="text-accent mt-1">Все плательщики оплатили взносы</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-red-50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-red-800">ФИО</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-red-800">Контакты</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-red-800">Факультет/Группа</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-red-800">Статус</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-red-800">Оплачено</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-red-800">Действия</th>
                </tr>
              </thead>
              <tbody>
                {debtors.map((debtor) => (
                  <tr key={debtor.id} className="border-b border-light-dark last:border-0 transition-colors duration-150 hover:bg-red-50/50">
                    <td className="py-3 px-4">
                      <Link
                        to={`/payers/${debtor.id}`}
                        className="text-dark hover:text-primary font-medium transition-colors duration-150"
                      >
                        {debtor.full_name}
                      </Link>
                      {debtor.course && (
                        <p className="text-xs text-accent">{debtor.course} курс</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {debtor.phone && <p className="text-accent">{debtor.phone}</p>}
                      {debtor.email && <p className="text-accent">{debtor.email}</p>}
                      {debtor.telegram && <p className="text-accent">{debtor.telegram}</p>}
                      {!debtor.phone && !debtor.email && !debtor.telegram && <p className="text-accent">—</p>}
                    </td>
                    <td className="py-3 px-4 text-accent">
                      {getFacultyName(debtor.faculty_id)}
                      {debtor.group_id && ` / ${getGroupName(debtor.group_id)}`}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={debtor.status} />
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-dark">
                      {formatMoney(debtor.total_paid)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/payers/${debtor.id}`}
                        className="btn-primary px-3 py-1 text-sm"
                      >
                        Внести платёж
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-light-dark">
            <p className="text-sm text-accent">
              Страница {page} из {pages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => updateFilter('page', String(page - 1))}
                disabled={page === 1}
                className="btn-outline px-3 py-1 text-sm disabled:opacity-50"
              >
                Назад
              </button>
              <button
                onClick={() => updateFilter('page', String(page + 1))}
                disabled={page === pages}
                className="btn-outline px-3 py-1 text-sm disabled:opacity-50"
              >
                Вперёд
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
