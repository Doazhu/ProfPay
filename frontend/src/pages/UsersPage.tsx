import { useEffect, useState } from 'react';
import type { User, UserRole } from '../types';
import { userApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const roleLabels: Record<UserRole, string> = {
  admin: 'Администратор',
  operator: 'Оператор',
  viewer: 'Просмотр',
};

const roleColors: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  operator: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-700',
};

export default function UsersPage() {
  const { isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('viewer');

  // Edit state
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('viewer');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await userApi.getAll();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUsername.trim() || !newEmail.trim() || !newPassword || !newFullName.trim()) {
      setError('Заполните все обязательные поля');
      return;
    }
    setError('');
    try {
      await userApi.create({
        username: newUsername,
        email: newEmail,
        password: newPassword,
        full_name: newFullName,
        role: newRole,
      });
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewFullName('');
      setNewRole('viewer');
      setShowCreateForm(false);
      await loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка при создании пользователя');
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUserId(user.id);
    setEditEmail(user.email);
    setEditFullName(user.full_name);
    setEditRole(user.role);
  };

  const handleSaveUser = async () => {
    if (!editingUserId) return;
    try {
      await userApi.update(editingUserId, {
        email: editEmail,
        full_name: editFullName,
        role: editRole,
      });
      setEditingUserId(null);
      await loadUsers();
    } catch (err: any) {
      console.error('Failed to update user:', err);
      setError(err.response?.data?.detail || 'Ошибка при обновлении пользователя');
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await userApi.update(user.id, { is_active: !user.is_active });
      await loadUsers();
    } catch (err) {
      console.error('Failed to toggle user:', err);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.id === currentUser?.id) return;
    if (!confirm(`Удалить пользователя "${user.full_name}"? Это действие необратимо.`)) return;
    try {
      await userApi.delete(user.id);
      await loadUsers();
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      setError(err.response?.data?.detail || 'Ошибка при удалении пользователя');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ru-RU');
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-lg font-medium text-dark">Доступ запрещён</p>
        <p className="text-accent mt-1">Эта страница доступна только администраторам</p>
      </div>
    );
  }

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-dark">Управление пользователями</h1>
          <p className="text-accent mt-1">Создание и управление учётными записями</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn-primary"
        >
          + Добавить
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm animate-scale-in">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="card mb-6 animate-slide-in">
          <h2 className="text-base md:text-lg font-semibold text-dark mb-4">Новый пользователь</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-accent mb-1">Логин *</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="username"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-accent mb-1">ФИО *</label>
              <input
                type="text"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-accent mb-1">Email *</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@example.com"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-accent mb-1">Пароль *</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Минимум 8 символов"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-accent mb-1">Роль</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="input"
              >
                <option value="viewer">Просмотр</option>
                <option value="operator">Оператор</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t border-light-dark">
            <button onClick={handleAddUser} className="btn-primary">
              Создать
            </button>
            <button
              onClick={() => { setShowCreateForm(false); setError(''); }}
              className="btn-ghost"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="card">
        <h2 className="text-base md:text-lg font-semibold text-dark mb-4">
          Пользователи ({users.length})
        </h2>

        {users.length === 0 ? (
          <p className="text-center text-accent py-8">Нет пользователей</p>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className={`p-3 rounded-lg border ${
                  user.is_active ? 'border-light-dark' : 'border-red-200 bg-red-50/50'
                }`}
              >
                {editingUserId === user.id ? (
                  /* Edit Mode */
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-accent mb-1">ФИО</label>
                        <input
                          type="text"
                          value={editFullName}
                          onChange={(e) => setEditFullName(e.target.value)}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-accent mb-1">Email</label>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-accent mb-1">Роль</label>
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as UserRole)}
                          className="input"
                          disabled={user.id === currentUser?.id}
                        >
                          <option value="viewer">Просмотр</option>
                          <option value="operator">Оператор</option>
                          <option value="admin">Администратор</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSaveUser} className="btn-primary">
                        Сохранить
                      </button>
                      <button onClick={() => setEditingUserId(null)} className="btn-ghost">
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display Mode */
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-dark">{user.full_name}</p>
                        {user.id === currentUser?.id && (
                          <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">Вы</span>
                        )}
                      </div>
                      <p className="text-sm text-accent">
                        {user.username} &middot; {user.email}
                      </p>
                      <p className="text-xs text-accent mt-0.5">
                        Последний вход: {formatDate(user.last_login)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${roleColors[user.role]}`}>
                        {roleLabels[user.role]}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {user.is_active ? 'Активен' : 'Неактивен'}
                      </span>
                      <button
                        onClick={() => handleEditUser(user)}
                        className="text-primary hover:text-primary-dark text-sm py-1"
                      >
                        Изменить
                      </button>
                      {user.id !== currentUser?.id && (
                        <>
                          <button
                            onClick={() => handleToggleActive(user)}
                            className={`text-sm py-1 ${
                              user.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'
                            }`}
                          >
                            {user.is_active ? 'Деактив.' : 'Активир.'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="text-red-600 hover:text-red-700 text-sm py-1"
                          >
                            Удалить
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-6 p-3 md:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Примечание:</strong> Деактивация блокирует вход пользователя в систему, но сохраняет его данные.
          Удаление полностью удаляет учётную запись.
        </p>
      </div>
    </div>
  );
}
