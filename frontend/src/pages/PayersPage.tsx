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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark">Плательщики</h1>
          <p className="text-accent mt-1">Всего: {total} записей</p>
        </div>
        {canEdit && (
          <Link to="/add-payer" className="btn-primary">
            + Добавить
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
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
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : payers.length === 0 ? (
          <div className="text-center py-12 text-accent">
            <p>Плательщики не найдены</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-light-dark/50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-accent">ФИО</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-accent">Факультет</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-accent">Группа</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-accent">Курс</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-accent">Статус</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-accent">Оплачено</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-accent">Действия</th>
                </tr>
              </thead>
              <tbody>
                {payers.map((payer) => (
                  <tr key={payer.id} className="border-b border-light-dark last:border-0 hover:bg-light-dark/30">
                    <td className="py-3 px-4">
                      <Link
                        to={`/payers/${payer.id}`}
                        className="text-dark hover:text-primary font-medium"
                      >
                        {payer.full_name}
                      </Link>
                      {payer.email && (
                        <p className="text-xs text-accent">{payer.email}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-accent">{getFacultyName(payer.faculty_id)}</td>
                    <td className="py-3 px-4 text-accent">{getGroupName(payer.group_id)}</td>
                    <td className="py-3 px-4 text-accent">{payer.course || '—'}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={payer.status} />
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-dark">
                      {formatMoney(payer.total_paid)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/payers/${payer.id}`}
                        className="text-primary hover:text-primary-dark text-sm"
                      >
                        Подробнее
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
