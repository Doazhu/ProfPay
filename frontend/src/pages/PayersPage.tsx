import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  DownloadIcon, ExclamationTriangleIcon, PlusIcon,
} from '@radix-ui/react-icons';
import {
  Badge, Button, Card, Checkbox, Flex, Heading, Select, Spinner, Text,
  Tooltip,
} from '@radix-ui/themes';
import type { Payer, Faculty, PaymentStatus } from '../types';
import { payerApi, facultyApi, exportApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import SearchField, { Highlight, searchWords } from '../components/SearchField';

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
  // Номер последнего запроса: ответ на более ранний, пришедший позже,
  // не должен затирать таблицу.
  const lastRequest = useRef(0);

  // Filter state from URL
  const page = parseInt(searchParams.get('page') || '1');
  const facultyId = searchParams.get('faculty') ? parseInt(searchParams.get('faculty')!) : undefined;
  const status = searchParams.get('status') as PaymentStatus | undefined;
  const search = searchParams.get('search') || '';
  const words = searchWords(search);
  const archiveMode = (searchParams.get('archive') || defaultArchive) as 'active' | 'archived' | 'all';
  const incompleteOnly = searchParams.get('incomplete') === '1';
  // Бюджетников часто нужно убрать с глаз: взносы собираются не с них,
  // и в работе со списком должников они только мешают.
  const hideBudget = searchParams.get('paying') === '1';

  /*
    Одна выпадашка на «что показываем»: архив и неполные данные — это срезы
    одного списка, и двумя отдельными переключателями рядом их путали.
    «Неполные» берутся без архива: разбираться с выпустившимися смысла нет.
  */
  const viewMode = incompleteOnly ? 'incomplete' : archiveMode;

  const changeView = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete('page');
    if (value === 'incomplete') {
      next.set('incomplete', '1');
      next.delete('archive');
    } else {
      next.delete('incomplete');
      if (value === defaultArchive) next.delete('archive');
      else next.set('archive', value);
    }
    setSearchParams(next);
  };

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadPayers();
  }, [page, facultyId, status, search, archiveMode, incompleteOnly, hideBudget]);

  const loadFilters = async () => {
    try {
      const facultyData = await facultyApi.getAll();
      setFaculties(facultyData);
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  };

  const loadPayers = async () => {
    const request = ++lastRequest.current;
    setIsLoading(true);
    try {
      const response = await payerApi.getAll({
        page,
        per_page: 20,
        faculty_id: facultyId,
        status,
        search: search || undefined,
        archive: archiveMode,
        incomplete: incompleteOnly || undefined,
        paying_only: hideBudget || undefined,
      });
      if (request !== lastRequest.current) return;
      setPayers(response.items);
      setTotal(response.total);
      setPages(response.pages);
    } catch (error) {
      console.error('Failed to load payers:', error);
    } finally {
      if (request === lastRequest.current) setIsLoading(false);
    }
  };

  // Поиск меняет адрес без новой записи в истории: «Назад» должен уводить
  // со страницы, а не перебирать набранные буквы.
  const applySearch = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('search', value); else next.delete('search');
    next.delete('page');
    setSearchParams(next, { replace: true });
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
        incomplete: incompleteOnly || undefined, paying_only: hideBudget || undefined,
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
          <SearchField
            value={search}
            onSearch={applySearch}
            busy={isLoading && Boolean(search)}
            style={{ flex: '2 1 260px' }}
          />

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
          <Select.Root value={viewMode} onValueChange={changeView}>
            <Select.Trigger style={{ flex: '1 1 190px' }} aria-label="Что показывать" />
            <Select.Content>
              <Select.Item value="active">Без архива</Select.Item>
              <Select.Item value="archived">Только архив</Select.Item>
              <Select.Item value="all">Все, включая архив</Select.Item>
              {/*
                Записи с пробелами надо уметь находить: загруженные из таблицы
                остаются без группы или даты, если в исходнике стоял «?». Без
                группы не считается курс, и такая запись не уйдёт в архив сама.
              */}
              <Select.Item value="incomplete">Неполные данные</Select.Item>
            </Select.Content>
          </Select.Root>

          <Text as="label" size="2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Checkbox
              checked={!hideBudget}
              onCheckedChange={(checked) => updateFilter('paying', checked ? '' : '1')}
            />
            Показывать бюджетников
          </Text>
        </Flex>
      </Card>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading && payers.length === 0 ? (
          <Flex align="center" justify="center" style={{ height: 220 }}>
            <Spinner size="3" />
          </Flex>
        ) : payers.length === 0 ? (
          <Flex direction="column" align="center" gap="3" py="9" className="animate-fade-in">
            <Text color="gray">{search ? 'Никого не нашлось' : 'Плательщики не найдены'}</Text>
            {search && (
              <Flex gap="2" wrap="wrap" justify="center">
                <Button variant="soft" color="gray" onClick={() => applySearch('')}>
                  Сбросить поиск
                </Button>
                {/* С 1 сентября выпускники уходят в архив сами — их чаще
                    всего и не находят в обычном списке. */}
                {viewMode === 'active' && (
                  <Button variant="soft" onClick={() => changeView('all')}>
                    Искать в архиве
                  </Button>
                )}
              </Flex>
            )}
          </Flex>
        ) : (
          // Старая страница остаётся на месте, пока грузится новая:
          // иначе таблица мигала бы на каждый набранный запрос.
          <div style={{
            opacity: isLoading ? 0.55 : 1,
            transition: 'opacity var(--dur-2) var(--ease)',
          }}>
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
                    <th className="text-right py-3 px-4 text-xs font-semibold text-accent-light uppercase tracking-wider">Внесено</th>
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
                            <Highlight text={payer.full_name} words={words} />
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
                          {payer.missing_fields.length > 0 && (
                            <Tooltip content={`Не заполнено: ${payer.missing_fields.join(', ')}`}>
                              <Badge color="amber" variant="soft" size="1">
                                <ExclamationTriangleIcon /> неполные
                              </Badge>
                            </Tooltip>
                          )}
                        </div>
                        {payer.email && (
                          <p className="text-xs text-accent">{payer.email}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-accent">{getFacultyName(payer.faculty_id)}</td>
                      <td className="py-3 px-4 font-mono text-sm whitespace-nowrap">
                        <Highlight text={payer.group_code || payer.group_name || '—'} words={words} />
                      </td>
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
                    payer.is_archived ? 'row-archived' : 'bg-panel'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-dark truncate">
                        <Highlight text={payer.full_name} words={words} />
                        {payer.is_budget && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Б</span>
                        )}
                      </p>
                      {payer.missing_fields.length > 0 && (
                        <Text as="p" size="1" color="amber">
                          не заполнено: {payer.missing_fields.join(', ')}
                        </Text>
                      )}
                      {payer.email && <p className="text-xs text-accent truncate">{payer.email}</p>}
                    </div>
                    <StatusBadge status={payer.status} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-accent">
                      {getFacultyName(payer.faculty_id)}
                      {(payer.group_code || payer.group_name) && (
                        <> • <Highlight text={(payer.group_code || payer.group_name)!} words={words} /></>
                      )}
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
          </div>
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
