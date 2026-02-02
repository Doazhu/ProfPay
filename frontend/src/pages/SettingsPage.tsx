import { useEffect, useState } from 'react';
import type { Faculty, StudentGroup, PaymentSettings } from '../types';
import { facultyApi, groupApi, paymentSettingsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'faculties' | 'groups' | 'payment'>('faculties');

  // Data
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings[]>([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Faculty form
  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultyShort, setNewFacultyShort] = useState('');
  const [editingFacultyId, setEditingFacultyId] = useState<number | null>(null);
  const [editFacultyName, setEditFacultyName] = useState('');
  const [editFacultyShort, setEditFacultyShort] = useState('');

  // Group form
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCourse, setNewGroupCourse] = useState<number | undefined>(undefined);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupCourse, setEditGroupCourse] = useState<number | undefined>(undefined);

  // Payment settings form
  const [newAcademicYear, setNewAcademicYear] = useState('');
  const [newFallAmount, setNewFallAmount] = useState('');
  const [newSpringAmount, setNewSpringAmount] = useState('');
  const [newCurrency, setNewCurrency] = useState('RUB');
  const [editingSettingsId, setEditingSettingsId] = useState<number | null>(null);
  const [editFallAmount, setEditFallAmount] = useState('');
  const [editSpringAmount, setEditSpringAmount] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [facultyData, groupData, settingsData] = await Promise.all([
        facultyApi.getAll(false),
        groupApi.getAll(undefined, false),
        paymentSettingsApi.getAll(),
      ]);
      setFaculties(facultyData);
      setGroups(groupData);
      setPaymentSettings(settingsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Faculty handlers
  const handleAddFaculty = async () => {
    if (!newFacultyName.trim()) return;
    try {
      await facultyApi.create({
        name: newFacultyName,
        short_name: newFacultyShort || undefined,
      });
      setNewFacultyName('');
      setNewFacultyShort('');
      const data = await facultyApi.getAll(false);
      setFaculties(data);
    } catch (error) {
      console.error('Failed to create faculty:', error);
    }
  };

  const handleEditFaculty = (faculty: Faculty) => {
    setEditingFacultyId(faculty.id);
    setEditFacultyName(faculty.name);
    setEditFacultyShort(faculty.short_name || '');
  };

  const handleSaveFaculty = async () => {
    if (!editingFacultyId) return;
    try {
      await facultyApi.update(editingFacultyId, {
        name: editFacultyName,
        short_name: editFacultyShort || undefined,
      });
      setEditingFacultyId(null);
      const data = await facultyApi.getAll(false);
      setFaculties(data);
    } catch (error) {
      console.error('Failed to update faculty:', error);
    }
  };

  const handleToggleFacultyActive = async (faculty: Faculty) => {
    try {
      await facultyApi.update(faculty.id, { is_active: !faculty.is_active });
      const data = await facultyApi.getAll(false);
      setFaculties(data);
    } catch (error) {
      console.error('Failed to toggle faculty:', error);
    }
  };

  // Group handlers
  const handleAddGroup = async () => {
    if (!newGroupName.trim()) {
      alert('Введите название группы');
      return;
    }
    if (!selectedFacultyId) {
      alert('Выберите факультет для группы');
      return;
    }
    try {
      await groupApi.create({
        name: newGroupName,
        faculty_id: selectedFacultyId,
        course: newGroupCourse,
      });
      setNewGroupName('');
      setNewGroupCourse(undefined);
      const data = await groupApi.getAll(undefined, false);
      setGroups(data);
    } catch (error: any) {
      console.error('Failed to create group:', error);
      alert(error.response?.data?.detail || 'Ошибка при создании группы');
    }
  };

  const handleEditGroup = (group: StudentGroup) => {
    setEditingGroupId(group.id);
    setEditGroupName(group.name);
    setEditGroupCourse(group.course || undefined);
  };

  const handleSaveGroup = async () => {
    if (!editingGroupId) return;
    try {
      await groupApi.update(editingGroupId, {
        name: editGroupName,
        course: editGroupCourse,
      });
      setEditingGroupId(null);
      const data = await groupApi.getAll(undefined, false);
      setGroups(data);
    } catch (error) {
      console.error('Failed to update group:', error);
    }
  };

  const handleToggleGroupActive = async (group: StudentGroup) => {
    try {
      await groupApi.update(group.id, { is_active: !group.is_active });
      const data = await groupApi.getAll(undefined, false);
      setGroups(data);
    } catch (error) {
      console.error('Failed to toggle group:', error);
    }
  };

  // Payment settings handlers
  const handleAddPaymentSettings = async () => {
    if (!newAcademicYear || !newFallAmount || !newSpringAmount) return;
    try {
      await paymentSettingsApi.create({
        academic_year: newAcademicYear,
        currency: newCurrency,
        fall_amount: Number(newFallAmount),
        spring_amount: Number(newSpringAmount),
      });
      setNewAcademicYear('');
      setNewFallAmount('');
      setNewSpringAmount('');
      const data = await paymentSettingsApi.getAll();
      setPaymentSettings(data);
    } catch (error) {
      console.error('Failed to create payment settings:', error);
    }
  };

  const handleEditPaymentSettings = (settings: PaymentSettings) => {
    setEditingSettingsId(settings.id);
    setEditFallAmount(String(settings.fall_amount));
    setEditSpringAmount(String(settings.spring_amount));
  };

  const handleSavePaymentSettings = async () => {
    if (!editingSettingsId) return;
    try {
      await paymentSettingsApi.update(editingSettingsId, {
        fall_amount: Number(editFallAmount),
        spring_amount: Number(editSpringAmount),
      });
      setEditingSettingsId(null);
      const data = await paymentSettingsApi.getAll();
      setPaymentSettings(data);
    } catch (error) {
      console.error('Failed to update payment settings:', error);
    }
  };

  const handleDeletePaymentSettings = async (id: number) => {
    if (!confirm('Удалить настройки оплаты?')) return;
    try {
      await paymentSettingsApi.delete(id);
      const data = await paymentSettingsApi.getAll();
      setPaymentSettings(data);
    } catch (error) {
      console.error('Failed to delete payment settings:', error);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Generate academic year options
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const year = currentYear - 2 + i;
    return `${year}-${year + 1}`;
  });

  // Filter groups by faculty
  const filteredGroups = selectedFacultyId
    ? groups.filter(g => g.faculty_id === selectedFacultyId)
    : groups;

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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark">Настройки системы</h1>
        <p className="text-accent mt-1">Управление справочниками и настройками</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('faculties')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'faculties'
              ? 'bg-primary text-white'
              : 'bg-light-dark text-accent hover:bg-light-dark/70'
          }`}
        >
          Факультеты
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'groups'
              ? 'bg-primary text-white'
              : 'bg-light-dark text-accent hover:bg-light-dark/70'
          }`}
        >
          Группы
        </button>
        <button
          onClick={() => setActiveTab('payment')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'payment'
              ? 'bg-primary text-white'
              : 'bg-light-dark text-accent hover:bg-light-dark/70'
          }`}
        >
          Оплата по семестрам
        </button>
      </div>

      {/* Faculties Tab */}
      {activeTab === 'faculties' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-dark mb-4">Факультеты</h2>

          {/* Add Faculty Form */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newFacultyName}
              onChange={(e) => setNewFacultyName(e.target.value)}
              placeholder="Название факультета"
              className="input flex-1"
            />
            <input
              type="text"
              value={newFacultyShort}
              onChange={(e) => setNewFacultyShort(e.target.value)}
              placeholder="Сокр."
              className="input w-24"
            />
            <button onClick={handleAddFaculty} className="btn-primary px-4">
              + Добавить
            </button>
          </div>

          {/* Faculty List */}
          <div className="space-y-2">
            {faculties.map((faculty) => (
              <div
                key={faculty.id}
                className={`p-3 rounded-lg border ${
                  faculty.is_active ? 'border-light-dark' : 'border-red-200 bg-red-50/50'
                }`}
              >
                {editingFacultyId === faculty.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editFacultyName}
                      onChange={(e) => setEditFacultyName(e.target.value)}
                      className="input flex-1"
                    />
                    <input
                      type="text"
                      value={editFacultyShort}
                      onChange={(e) => setEditFacultyShort(e.target.value)}
                      className="input w-24"
                    />
                    <button onClick={handleSaveFaculty} className="btn-primary px-3">
                      Сохранить
                    </button>
                    <button onClick={() => setEditingFacultyId(null)} className="btn-ghost px-3">
                      Отмена
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-dark">{faculty.name}</p>
                      {faculty.short_name && (
                        <p className="text-sm text-accent">{faculty.short_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        faculty.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {faculty.is_active ? 'Активен' : 'Неактивен'}
                      </span>
                      <button
                        onClick={() => handleEditFaculty(faculty)}
                        className="text-primary hover:text-primary-dark text-sm"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => handleToggleFacultyActive(faculty)}
                        className={`text-sm ${
                          faculty.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'
                        }`}
                      >
                        {faculty.is_active ? 'Деактивировать' : 'Активировать'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Groups Tab */}
      {activeTab === 'groups' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-dark mb-4">Группы</h2>

          {/* Faculty filter */}
          <div className="mb-4">
            <select
              value={selectedFacultyId || ''}
              onChange={(e) => setSelectedFacultyId(e.target.value ? Number(e.target.value) : null)}
              className="input"
            >
              <option value="">Все факультеты</option>
              {faculties.filter(f => f.is_active).map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Add Group Form */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 mb-3">
              <strong>Важно:</strong> Для создания группы необходимо выбрать факультет выше
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Название группы (например: ИВТ-21)"
                className="input flex-1"
                disabled={!selectedFacultyId}
              />
              <select
                value={newGroupCourse || ''}
                onChange={(e) => setNewGroupCourse(e.target.value ? Number(e.target.value) : undefined)}
                className="input w-28"
                disabled={!selectedFacultyId}
              >
                <option value="">Курс</option>
                {[1, 2, 3, 4, 5, 6].map((c) => (
                  <option key={c} value={c}>{c} курс</option>
                ))}
              </select>
              <button 
                onClick={handleAddGroup} 
                className="btn-primary px-4"
                disabled={!selectedFacultyId}
              >
                + Добавить
              </button>
            </div>
          </div>

          {/* Group List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredGroups.length === 0 ? (
              <p className="text-center text-accent py-4">Нет групп</p>
            ) : (
              filteredGroups.map((group) => (
                <div
                  key={group.id}
                  className={`p-3 rounded-lg border ${
                    group.is_active ? 'border-light-dark' : 'border-red-200 bg-red-50/50'
                  }`}
                >
                  {editingGroupId === group.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                        className="input flex-1"
                      />
                      <select
                        value={editGroupCourse || ''}
                        onChange={(e) => setEditGroupCourse(e.target.value ? Number(e.target.value) : undefined)}
                        className="input w-28"
                      >
                        <option value="">Курс</option>
                        {[1, 2, 3, 4, 5, 6].map((c) => (
                          <option key={c} value={c}>{c} курс</option>
                        ))}
                      </select>
                      <button onClick={handleSaveGroup} className="btn-primary px-3">
                        Сохранить
                      </button>
                      <button onClick={() => setEditingGroupId(null)} className="btn-ghost px-3">
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-dark">{group.name}</p>
                        <p className="text-sm text-accent">
                          {group.faculty?.short_name || group.faculty?.name || 'Факультет не указан'}
                          {group.course && ` • ${group.course} курс`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          group.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {group.is_active ? 'Активна' : 'Неактивна'}
                        </span>
                        <button
                          onClick={() => handleEditGroup(group)}
                          className="text-primary hover:text-primary-dark text-sm"
                        >
                          Изменить
                        </button>
                        <button
                          onClick={() => handleToggleGroupActive(group)}
                          className={`text-sm ${
                            group.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'
                          }`}
                        >
                          {group.is_active ? 'Деактивировать' : 'Активировать'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Payment Settings Tab */}
      {activeTab === 'payment' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-dark mb-4">Настройки оплаты по семестрам</h2>
          <p className="text-accent text-sm mb-4">
            Укажите сумму оплаты за каждый семестр для каждого учебного года
          </p>

          {/* Add Payment Settings Form */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-6 p-4 bg-light-dark/30 rounded-lg">
            <select
              value={newAcademicYear}
              onChange={(e) => setNewAcademicYear(e.target.value)}
              className="input"
            >
              <option value="">Учебный год</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <input
              type="number"
              value={newFallAmount}
              onChange={(e) => setNewFallAmount(e.target.value)}
              placeholder="Осень (₽)"
              className="input"
              min="0"
            />
            <input
              type="number"
              value={newSpringAmount}
              onChange={(e) => setNewSpringAmount(e.target.value)}
              placeholder="Весна (₽)"
              className="input"
              min="0"
            />
            <select
              value={newCurrency}
              onChange={(e) => setNewCurrency(e.target.value)}
              className="input"
            >
              <option value="RUB">RUB (₽)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
            <button onClick={handleAddPaymentSettings} className="btn-primary">
              + Добавить
            </button>
          </div>

          {/* Payment Settings List */}
          <div className="space-y-3">
            {paymentSettings.length === 0 ? (
              <p className="text-center text-accent py-4">Нет настроек оплаты</p>
            ) : (
              paymentSettings.map((settings) => (
                <div
                  key={settings.id}
                  className="p-4 rounded-lg border border-light-dark"
                >
                  {editingSettingsId === settings.id ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <div className="font-medium text-dark py-2">
                        {settings.academic_year}
                      </div>
                      <input
                        type="number"
                        value={editFallAmount}
                        onChange={(e) => setEditFallAmount(e.target.value)}
                        placeholder="Осень"
                        className="input"
                        min="0"
                      />
                      <input
                        type="number"
                        value={editSpringAmount}
                        onChange={(e) => setEditSpringAmount(e.target.value)}
                        placeholder="Весна"
                        className="input"
                        min="0"
                      />
                      <div className="flex gap-2">
                        <button onClick={handleSavePaymentSettings} className="btn-primary flex-1">
                          Сохранить
                        </button>
                        <button onClick={() => setEditingSettingsId(null)} className="btn-ghost">
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="grid grid-cols-4 gap-4 flex-1">
                        <div>
                          <p className="text-sm text-accent">Учебный год</p>
                          <p className="font-semibold text-dark">{settings.academic_year}</p>
                        </div>
                        <div>
                          <p className="text-sm text-accent">Осенний семестр</p>
                          <p className="font-medium text-dark">{formatMoney(settings.fall_amount)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-accent">Весенний семестр</p>
                          <p className="font-medium text-dark">{formatMoney(settings.spring_amount)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-accent">Итого за год</p>
                          <p className="font-bold text-primary">{formatMoney(settings.total_year_amount)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEditPaymentSettings(settings)}
                          className="text-primary hover:text-primary-dark text-sm"
                        >
                          Изменить
                        </button>
                        <button
                          onClick={() => handleDeletePaymentSettings(settings.id)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Примечание:</strong> Деактивация факультетов и групп не удаляет связанные данные.
          Неактивные записи не отображаются в выпадающих списках при создании плательщиков.
        </p>
      </div>
    </div>
  );
}
