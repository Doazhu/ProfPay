import { useEffect, useState } from 'react';
import type { AuditLogEntry } from '../types';
import { statsApi } from '../services/api';

const ACTION_LABELS: Record<string, string> = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
  deactivate: 'Скрытие',
  login: 'Вход',
  login_locked: 'Блокировка входа',
  password_changed: 'Смена пароля',
  password_set: 'Пароль задан администратором',
  password_reset: 'Пароль восстановлен',
  password_reset_requested: 'Запрос восстановления',
  unlock: 'Снятие блокировки',
};

const ENTITY_LABELS: Record<string, string> = {
  payer: 'Плательщик',
  payment: 'Платёж',
  user: 'Пользователь',
};

/** Журнал изменений. Раньше таблица существовала, но в неё никто не писал. */
export default function AuditPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    statsApi.getAudit(200)
      .then(setEntries)
      .catch((error) => console.error('Не удалось загрузить журнал:', error))
      .finally(() => setIsLoading(false));
  }, []);

  const formatWhen = (value: string) =>
    new Date(value).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="animate-fade-in">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-semibold text-dark">Журнал изменений</h1>
        <p className="text-sm text-accent mt-1">
          Кто и что менял. Полезно, когда данные разошлись и нужно понять, с какого момента.
        </p>
      </div>

      <div className="card-flush">
        {isLoading ? (
          <div className="spinner-container"><div className="spinner w-8 h-8" /></div>
        ) : entries.length === 0 ? (
          <p className="text-center py-12 text-accent text-sm">Записей пока нет</p>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Когда</th>
                  <th className="th">Действие</th>
                  <th className="th">Объект</th>
                  <th className="th">Подробности</th>
                  <th className="th table-col-mobile-hidden">IP</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="table-row-interactive">
                    <td className="td whitespace-nowrap font-mono text-xs text-accent">
                      {formatWhen(entry.created_at)}
                    </td>
                    <td className="td whitespace-nowrap">
                      {ACTION_LABELS[entry.action] || entry.action}
                    </td>
                    <td className="td whitespace-nowrap text-accent">
                      {ENTITY_LABELS[entry.entity_type] || entry.entity_type}
                      {entry.entity_id != null && ` #${entry.entity_id}`}
                    </td>
                    <td className="td text-accent">{entry.summary || '—'}</td>
                    <td className="td table-col-mobile-hidden font-mono text-xs text-accent-light">
                      {entry.ip_address || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
