import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Payer, Faculty, StudentGroup, PaymentStatus } from '../types';
import { payerApi, facultyApi, groupApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

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

export default function PayersPage() {
  const [payers, setPayers] = useState<Payer[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const [searchParams, setSearchParams] = useSearchParams();
  const { canEdit } = useAuth();

  // Filter state from URL
  const page = parseInt(searchParams.get('page') || '1');
  const facultyId = searchParams.get('faculty') ? parseInt(searchParams.get('faculty')!) : undefined;
  const groupId = searchParams.get('group') ? parseInt(searchParams.get('group')!) : undefined;
  const status = searchParams.get('status') as PaymentStatus | undefined;
  const search = searchParams.get('search') || '';

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadPayers();
  }, [page, facultyId, groupId, status, search]);

  useEffect(() => {
    if (facultyId) {
      loadGroups(facultyId);
    } else {
      loadAllGroups();
    }
  }, [facultyId]);

  const loadFilters = async () => {
    try {
      const facultyData = await facultyApi.getAll();
      setFaculties(facultyData);
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  };

  const loadAllGroups = async () => {
    try {
      const groupData = await groupApi.getAll();
      setGroups(groupData);
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const loadGroups = async (facultyId: number) => {
    try {
      const groupData = await groupApi.getAll(facultyId);
      setGroups(groupData);
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const loadPayers = async () => {
    setIsLoading(true);
    try {
      const response = await payerApi.getAll({
        page,
        per_page: 20,
        faculty_id: facultyId,
        group_id: groupId,
        status,
        search: search || undefined,
      });
      setPayers(response.items);
      setTotal(response.total);
      setPages(response.pages);
    } catch (error) {
      console.error('Failed to load payers:', error);
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
      newParams.delete('page'); // Reset page on filter change
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
    if (!id) return '—';
    const group = groups.find(g => g.id === id);
    return group?.name || '—';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ru-RU');
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-dark">Плательщики</h1>
          <p className="text-accent mt-1">Всего: {total} записей</p>
        </div>
        {canEdit && (
          <Link to="/add-payer" className="btn-primary w-full sm:w-auto justify-center">
            + Добавить
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          {/* Search */}
          <div className="sm:col-span-2 lg:col-span-2">
            <input
              type="text"
              placeholder="Поиск по ФИО, email, телефону..."
              value={search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="input"
            />
          </div>

          {/* Faculty Filter */}
          <select
            value={facultyId || ''}
            onChange={(e) => {
              updateFilter('faculty', e.target.value);
              updateFilter('group', undefined);
            }}
            className="input"
          >
            <option value="">Все факультеты</option>
            {faculties.map((f) => (
              <option key={f.id} value={f.id}>
                {f.short_name || f.name}
              </option>
            ))}
          </select>

          {/* Group Filter */}
          <select
            value={groupId || ''}
            onChange={(e) => updateFilter('group', e.target.value)}
            className="input"
          >
            <option value="">Все группы</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={status || ''}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="input"
          >
            <option value="">Все статусы</option>
            <option value="paid">Оплачено</option>
            <option value="partial">Частично</option>
            <option value="unpaid">Не оплачено</option>
            <option value="exempt">Освобождён</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 animate-fade-in">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : payers.length === 0 ? (
          <div className="text-center py-12 text-accent animate-fade-in">
            <p>Плательщики не найдены</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-light-dark">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-accent/70 uppercase tracking-wider">ФИО</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-accent/70 uppercase tracking-wider">Факультет</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-accent/70 uppercase tracking-wider">Группа</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-accent/70 uppercase tracking-wider">Курс</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-accent/70 uppercase tracking-wider">Д. рождения</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-accent/70 uppercase tracking-wider">Статус</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-accent/70 uppercase tracking-wider">Оплачено</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-accent/70 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody>
                  {payers.map((payer) => (
                    <tr key={payer.id} className="border-b border-light-dark/50 last:border-0 table-row-interactive">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/payers/${payer.id}`}
                            className="text-dark hover:text-primary font-medium transition-colors duration-150"
                          >
                            {payer.full_name}
                          </Link>
                          {payer.is_budget && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium" title="Бюджетник">Б</span>
                          )}
                        </div>
                        {payer.email && (
                          <p className="text-xs text-accent">{payer.email}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-accent">{getFacultyName(payer.faculty_id)}</td>
                      <td className="py-3 px-4 text-accent">{getGroupName(payer.group_id)}</td>
                      <td className="py-3 px-4 text-accent">{payer.course || '—'}</td>
                      <td className="py-3 px-4 text-accent">{formatDate(payer.date_of_birth)}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={payer.status} />
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-dark">
                        {formatMoney(payer.total_paid)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/payers/${payer.id}`}
                          className="text-primary hover:text-primary-dark text-sm transition-colors duration-150"
                        >
                          Подробнее
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {payers.map((payer) => (
                <Link
                  key={payer.id}
                  to={`/payers/${payer.id}`}
                  className="block p-4 bg-light/60 rounded-xl active:bg-light-dark/40 transition-all duration-150 hover:shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-dark truncate">
                        {payer.full_name}
                        {payer.is_budget && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Б</span>
                        )}
                      </p>
                      {payer.email && (
                        <p className="text-xs text-accent truncate">{payer.email}</p>
                      )}
                    </div>
                    <StatusBadge status={payer.status} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-accent">
                      {getFacultyName(payer.faculty_id)} • {getGroupName(payer.group_id)}
                      {payer.course && ` • ${payer.course} курс`}
                      {payer.date_of_birth && ` • д.р. ${formatDate(payer.date_of_birth)}`}
                    </span>
                    <span className="font-medium text-dark">{formatMoney(payer.total_paid)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-light-dark/50">
            <p className="text-sm text-accent order-2 sm:order-1">
              Страница {page} из {pages}
            </p>
            <div className="flex gap-2 order-1 sm:order-2 w-full sm:w-auto">
              <button
                onClick={() => updateFilter('page', String(page - 1))}
                disabled={page === 1}
                className="btn-outline btn-sm flex-1 sm:flex-none justify-center disabled:opacity-50"
              >
                Назад
              </button>
              <button
                onClick={() => updateFilter('page', String(page + 1))}
                disabled={page === pages}
                className="btn-outline btn-sm flex-1 sm:flex-none justify-center disabled:opacity-50"
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
