import React, { useState, useMemo } from 'react';
import SearchFilters from './components/SearchFilters';
import UsersTable from './components/UsersTable';
import UserModal from './components/UserModal';
import Notification from './components/Notification';
import type { User, FilterState, UserRole } from './types';

// Моковые данные для демонстрации
const mockUsers: User[] = [
  {
    id: '1',
    fullName: 'Иванов Иван Иванович',
    lastPaymentAmount: 1500,
    lastPaymentDate: '2024-12-01',
    status: 'paid',
    contact: { telegram: 'ivan_ivanov', vk: 'ivan.ivanov' },
    paymentHistory: [
      { id: '1', amount: 1500, date: '2024-12-01', status: 'completed' },
      { id: '2', amount: 1500, date: '2024-11-01', status: 'completed' },
    ]
  },
  {
    id: '2',
    fullName: 'Петрова Анна Сергеевна',
    lastPaymentAmount: 750,
    lastPaymentDate: '2024-11-15',
    status: 'partial',
    contact: { telegram: 'anna_petrova' },
    paymentHistory: [
      { id: '3', amount: 750, date: '2024-11-15', status: 'completed' },
    ]
  },
  {
    id: '3',
    fullName: 'Сидоров Петр Александрович',
    status: 'debt',
    contact: { vk: 'petr.sidorov' },
    paymentHistory: []
  },
  {
    id: '4',
    fullName: 'Козлова Мария Викторовна',
    lastPaymentAmount: 1500,
    lastPaymentDate: '2024-12-10',
    status: 'paid',
    contact: { telegram: 'maria_kozlova', vk: 'maria.kozlova' },
    paymentHistory: [
      { id: '4', amount: 1500, date: '2024-12-10', status: 'completed' },
      { id: '5', amount: 1500, date: '2024-11-10', status: 'completed' },
      { id: '6', amount: 1500, date: '2024-10-10', status: 'completed' },
    ]
  },
];

const PayersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [loading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    isVisible: boolean;
  }>({ message: '', type: 'info', isVisible: false });

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    contactType: 'all',
  });

  // Моковая роль пользователя (в реальном приложении будет из контекста/API)
  const userRole: UserRole = {
    isAdmin: true,
    canEdit: true,
  };

  // Фильтрация пользователей
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Поиск по имени
      if (filters.search && !user.fullName.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }

      // Фильтр по статусу
      if (filters.status !== 'all' && user.status !== filters.status) {
        return false;
      }

      // Фильтр по типу контакта
      if (filters.contactType !== 'all') {
        if (filters.contactType === 'telegram' && !user.contact.telegram) {
          return false;
        }
        if (filters.contactType === 'vk' && !user.contact.vk) {
          return false;
        }
      }

      // Фильтр по дате (если есть последний платеж)
      if (filters.dateFrom && user.lastPaymentDate) {
        if (new Date(user.lastPaymentDate) < new Date(filters.dateFrom)) {
          return false;
        }
      }
      if (filters.dateTo && user.lastPaymentDate) {
        if (new Date(user.lastPaymentDate) > new Date(filters.dateTo)) {
          return false;
        }
      }

      return true;
    });
  }, [users, filters]);
  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({ message, type, isVisible: true });
  };

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, isVisible: false }));
  };

  const handleExport = (format: 'pdf' | 'csv') => {
    showNotification(`Экспорт в ${format.toUpperCase()} начат`, 'info');
    // Здесь будет логика экспорта
  };



  const handleUserEdit = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleUserDelete = (userId: string) => {
    if (confirm('Вы уверены, что хотите удалить этого пользователя?')) {
      const user = users.find(u => u.id === userId);
      setUsers(users.filter(u => u.id !== userId));
      showNotification(`Пользователь ${user?.fullName} удален`, 'success');
    }
  };



  const handleBatchDelete = () => {
    if (selectedUsers.length === 0) return;
    if (confirm(`Вы уверены, что хотите удалить ${selectedUsers.length} пользователей?`)) {
      setUsers(users.filter(u => !selectedUsers.includes(u.id)));
      showNotification(`Удалено ${selectedUsers.length} пользователей`, 'success');
      setSelectedUsers([]);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Управление плательщиками
        </h1>
        <p className="text-gray-600">
          Всего участников: {users.length} | Отфильтровано: {filteredUsers.length}
        </p>
      </div>

      <SearchFilters
        filters={filters}
        onFiltersChange={setFilters}
        onExport={handleExport}
      />

      {selectedUsers.length > 0 && userRole.isAdmin && (
        <div className="bg-accent bg-opacity-10 border border-accent rounded-custom p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">
              Выбрано: {selectedUsers.length} пользователей
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleBatchDelete}
                className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
              >
                Удалить выбранных
              </button>
            </div>
          </div>
        </div>
      )}

      <UsersTable
        users={filteredUsers}
        loading={loading}
        userRole={userRole}
        selectedUsers={selectedUsers}
        onSelectionChange={setSelectedUsers}
        onUserEdit={handleUserEdit}
        onUserDelete={handleUserDelete}
        onUserSelect={handleUserSelect}
      />

      <UserModal
        user={selectedUser}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedUser(null);
        }}
        onEdit={handleUserEdit}
        canEdit={userRole.canEdit}
      />

      <Notification
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />
    </div>
  );
};

export default PayersPage;