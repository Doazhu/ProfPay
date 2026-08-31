import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DownloadIcon, MagnifyingGlassIcon, PlusIcon } from '@radix-ui/react-icons';
import {
  Button, Card, Flex, Heading, Select, Spinner, Text, TextField,
} from '@radix-ui/themes';
import type { Payer, Faculty, PaymentStatus } from '../types';
import { payerApi, facultyApi, exportApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * Метка статуса.
 *
 * «Частично» показывается отдельно: статус наконец выставляется по-настоящему
 * (взнос за один семестр из двух), и сваливать его в «не оплачено» значит
 * скрывать от бухгалтера, что человек уже платил.
 */
function StatusBadge({ status }: { status: PaymentStatus }) {
  if (status === 'paid') return <span className="badge-success">Оплачено</span>;
  if (status === 'partial') return <span className="badge-warning">Частично</span>;
  if (status === 'exempt') return <span className="badge-info">Освобождён</span>;
  return <span className="badge-danger">Не оплачено</span>;
}

interface PayersPageProps {
  /** С каким режимом архива открывать страницу. Маршрут /archive передаёт 'archived'. */
  defaultArchive?: 'active' | 'archived' | 'all';
}

export default function PayersPage({ defaultArchive = 'active' }: PayersPageProps) {
  const [payers, setPayers] = useState<Payer[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const { canEdit } = useAuth();

  // Filter state from URL
  const page = parseInt(searchParams.get('page') || '1');
  const facultyId = searchParams.get('faculty') ? parseInt(searchParams.get('faculty')!) : undefined;
  const status = searchParams.get('status') as PaymentStatus | undefined;
  const search = searchParams.get('search') || '';
  const archiveMode = (searchParams.get('archive') || defaultArchive) as 'active' | 'archived' | 'all';

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadPayers();
  }, [page, facultyId, status, search, archiveMode]);

  const loadFilters = async () => {
    try {
      const facultyData = await facultyApi.getAll();
      setFaculties(facultyData);
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  };

  const loadPayers = async () => {
    setIsLoading(true);
    try {
      const response = await payerApi.getAll({
        page,
        per_page: 20,
        faculty_id: facultyId,
        status,
        search: search || undefined,
        archive: archiveMode,
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
    // 'active' — значение по умолчанию, в URL его держать незачем
    if (key === 'archive' && value === defaultArchive) value = undefined;
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

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(amount);

  const getFacultyName = (id: number | null) => {
    if (!id) return '—';
    const faculty = faculties.find(f => f.id === id);
    return faculty?.short_name || faculty?.name || '—';
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportApi.exportPayersExcel({
        faculty_id: facultyId, status, search: search || undefined, archive: archiveMode,
      });
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ru-RU');
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <Flex direction={{ initial: 'column', sm: 'row' }} align={{ sm: 'center' }}
            justify="between" gap="3" mb="5">
        <div>
          <Heading size="6">
            {defaultArchive === 'archived' ? 'Архив выпускников' : 'Плательщики'}
          </Heading>
          <Text as="p" size="2" color="gray" mt="1">Всего: {total} записей</Text>
        </div>

        {/* Кнопки Radix, а не прежние классы: иначе рядом стоящие «Excel»
            и «Добавить» расходились по высоте и скруглениям. */}
        <Flex gap="2" wrap="wrap">
          <Button variant="soft" color="gray" onClick={handleExport} disabled={isExporting}
                  title="Экспорт в Excel">
            {isExporting ? <Spinner size="1" /> : <DownloadIcon />}
            {isExporting ? 'Экспорт…' : 'Excel'}
          </Button>
          {canEdit && (
            <Button asChild>
              <Link to="/add-payer"><PlusIcon />Добавить</Link>
            </Button>
          )}
        </Flex>
      </Flex>

      {/* Фильтры */}
      <Card size="2" mb="4">
        <Flex gap="3" wrap="wrap">
          <TextField.Root
            placeholder="Поиск по фамилии, группе, кафедре"
            value={search}
            onChange={(e) => updateFilter('search', e.target.value)}
            style={{ flex: '2 1 260px' }}
          >
            <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
          </TextField.Root>

          <Select.Root value={facultyId ? String(facultyId) : 'all'}
                       onValueChange={(v) => updateFilter('faculty', v === 'all' ? '' : v)}>
            <Select.Trigger style={{ flex: '1 1 190px' }} aria-label="Деректорат" />
            <Select.Content>
              <Select.Item value="all">Все деректораты</Select.Item>
              {faculties.map((f) => (
                <Select.Item key={f.id} value={String(f.id)}>{f.short_name || f.name}</Select.Item>
              ))}
            </Select.Content>
          </Select.Root>

          <Select.Root value={status || 'all'}
                       onValueChange={(v) => updateFilter('status', v === 'all' ? '' : v)}>
            <Select.Trigger style={{ flex: '1 1 150px' }} aria-label="Статус оплаты" />
            <Select.Content>
              <Select.Item value="all">Все статусы</Select.Item>
              <Select.Item value="paid">Оплачено</Select.Item>
              <Select.Item value="partial">Частично</Select.Item>
              <Select.Item value="unpaid">Не оплачено</Select.Item>
            </Select.Content>
          </Select.Root>

          {/* Выпустившиеся по умолчанию скрыты */}
          <Select.Root value={archiveMode} onValueChange={(v) => updateFilter('archive', v)}>
            <Select.Trigger style={{ flex: '1 1 170px' }} aria-label="Архив" />
            <Select.Content>
              <Select.Item value="active">Без архива</Select.Item>
              <Select.Item value="archived">Только архив</Select.Item>
              <Select.Item value="all">Все, включая архив</Select.Item>
            </Select.Content>
          </Select.Root>
        </Flex>
      </Card>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <Flex align="center" justify="center" style={{ height: 220 }}>
            <Spinner size="3" />
          </Flex>
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
                    <th className="text-left py-3 px-4 text-xs font-semibold text-accent-light uppercase tracking-wider">ФИО</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-accent-light uppercase tracking-wider">Деректорат</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-accent-light uppercase tracking-wider">Группа</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-accent-light uppercase tracking-wider">Курс</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-accent-light uppercase tracking-wider">Д. рождения</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-accent-light uppercase tracking-wider">Статус</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-accent-light uppercase tracking-wider">Оплачено</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-accent-light uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody>
                  {payers.map((payer) => (
                    <tr
                      key={payer.id}
                      className={`border-b border-line last:border-0 table-row-interactive ${
                        payer.is_archived ? 'row-archived' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/payers/${payer.id}`}
                            className="text-dark hover:text-primary font-medium transition-colors duration-150"
                          >
                            {payer.full_name}
                          </Link>
                          {payer.is_archived && (
                            <span
                              className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-medium"
                              title="Срок обучения вышел"
                            >
                              Архив
                            </span>
                          )}
                          {payer.is_budget && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium" title="Бюджетник">Б</span>
                          )}
                        </div>
                        {payer.email && (
                          <p className="text-xs text-accent">{payer.email}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-accent">{getFacultyName(payer.faculty_id)}</td>
                      <td className="py-3 px-4 font-mono text-sm whitespace-nowrap">{payer.group_code || payer.group_name || '—'}</td>
                      <td className="py-3 px-4 text-accent">{payer.is_archived ? '—' : payer.course || '—'}</td>
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
                  className={`block p-3 border border-light-dark rounded transition-colors duration-100 hover:border-accent-light ${
                    payer.is_archived ? 'row-archived' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-dark truncate">
                        {payer.full_name}
                        {payer.is_budget && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Б</span>
                        )}
                      </p>
                      {payer.email && <p className="text-xs text-accent truncate">{payer.email}</p>}
                    </div>
                    <StatusBadge status={payer.status} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-accent">
                      {getFacultyName(payer.faculty_id)}
                      {(payer.group_code || payer.group_name) && ` • ${payer.group_code || payer.group_name}`}
                      {payer.is_archived
                        ? ' • архив'
                        : payer.course ? ` • ${payer.course} курс` : ''}
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-line">
            <p className="text-sm text-accent order-2 sm:order-1">
              Страница {page} из {pages}
            </p>
            <div className="flex gap-2 order-1 sm:order-2 w-full sm:w-auto">
              <button
                onClick={() => updateFilter('page', String(page - 1))}
                disabled={page === 1}
                className="btn-outline btn-sm flex-1 sm:flex-none justify-center"
              >
                Назад
              </button>
              <button
                onClick={() => updateFilter('page', String(page + 1))}
                disabled={page === pages}
                className="btn-outline btn-sm flex-1 sm:flex-none justify-center"
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
