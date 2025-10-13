import React, { useState } from 'react';
import type { User, UserRole } from '../types';

interface UsersTableProps {
  users: User[];
  loading?: boolean;
  userRole: UserRole;
  onUserSelect?: (user: User) => void;
  onUserEdit?: (user: User) => void;
  onUserDelete?: (userId: string) => void;
  onRemind?: (userId: string) => void;
  selectedUsers?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
}

const UsersTable: React.FC<UsersTableProps> = ({
  users,
  loading = false,
  userRole,
  onUserSelect,
  onUserEdit,
  onUserDelete,
  onRemind,
  selectedUsers = [],
  onSelectionChange,
}) => {
  const [sortField, setSortField] = useState<keyof User>('fullName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const getStatusColor = (status: User['status']) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-50';
      case 'debt': return 'text-red-600 bg-red-50';
      case 'partial': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: User['status']) => {
    switch (status) {
      case 'paid': return 'Оплачено';
      case 'debt': return 'Долг';
      case 'partial': return 'Частично';
      default: return 'Неизвестно';
    }
  };

  const handleSort = (field: keyof User) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleRowExpansion = (userId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedRows(newExpanded);
  };

  const handleSelectAll = (checked: boolean) => {
    if (onSelectionChange) {
      onSelectionChange(checked ? users.map(u => u.id) : []);
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    if (onSelectionChange) {
      const newSelection = checked
        ? [...selectedUsers, userId]
        : selectedUsers.filter(id => id !== userId);
      onSelectionChange(newSelection);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-custom shadow-soft overflow-hidden">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 border-t border-gray-200"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-custom shadow-soft overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {userRole.isAdmin && (
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === users.length && users.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-accent focus:ring-accent"
                  />
                </th>
              )}
              <th
                className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('fullName')}
              >
                ФИО {sortField === 'fullName' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('lastPaymentAmount')}
              >
                Последняя оплата {sortField === 'lastPaymentAmount' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('status')}
              >
                Статус {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                Контакт
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <React.Fragment key={user.id}>
                <tr 
                  className="hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                  onClick={() => onUserSelect && onUserSelect(user)}
                >
                  {userRole.isAdmin && (
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                        className="rounded border-gray-300 text-accent focus:ring-accent"
                      />
                    </td>
                  )}
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">
                    {user.fullName}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {user.lastPaymentAmount ? (
                      <div>
                        <div className="font-medium">{user.lastPaymentAmount} ₽</div>
                        {user.lastPaymentDate && (
                          <div className="text-xs text-gray-500">
                            {new Date(user.lastPaymentDate).toLocaleDateString('ru-RU')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">Нет данных</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(user.status)}`}>
                      {getStatusText(user.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">
                    <div className="flex gap-2">
                      {user.contact.telegram && (
                        <a
                          href={`https://t.me/${user.contact.telegram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          TG
                        </a>
                      )}
                      {user.contact.vk && (
                        <a
                          href={`https://vk.com/${user.contact.vk}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          VK
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleRowExpansion(user.id)}
                        className="text-accent hover:text-accent-solid transition-colors duration-200"
                      >
                        {expandedRows.has(user.id) ? 'Скрыть' : 'Подробнее'}
                      </button>
                      {onRemind && (
                        <button
                          onClick={() => onRemind(user.id)}
                          className="text-yellow-600 hover:text-yellow-800 transition-colors duration-200"
                        >
                          Напомнить
                        </button>
                      )}
                      {userRole.canEdit && onUserEdit && (
                        <button
                          onClick={() => onUserEdit(user)}
                          className="text-blue-600 hover:text-blue-800 transition-colors duration-200"
                        >
                          Изменить
                        </button>
                      )}
                      {userRole.isAdmin && onUserDelete && (
                        <button
                          onClick={() => onUserDelete(user.id)}
                          className="text-red-600 hover:text-red-800 transition-colors duration-200"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                
                {/* Развернутая строка с деталями */}
                {expandedRows.has(user.id) && (
                  <tr>
                    <td colSpan={userRole.isAdmin ? 6 : 5} className="px-4 py-4 bg-gray-50">
                      <div className="space-y-3">
                        <h4 className="font-medium text-gray-900">История платежей</h4>
                        {user.paymentHistory.length > 0 ? (
                          <div className="space-y-2">
                            {user.paymentHistory.slice(0, 5).map((payment) => (
                              <div key={payment.id} className="flex justify-between items-center text-sm">
                                <span>{new Date(payment.date).toLocaleDateString('ru-RU')}</span>
                                <span className="font-medium">{payment.amount} ₽</span>
                                <span className={`px-2 py-1 rounded text-xs ${
                                  payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {payment.status === 'completed' ? 'Завершен' :
                                   payment.status === 'pending' ? 'В обработке' : 'Отклонен'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm">Нет истории платежей</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UsersTable;