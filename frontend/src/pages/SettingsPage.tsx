import { useEffect, useState } from 'react';
import type { Faculty, PaymentSettings, BudgetSettings } from '../types';
import { facultyApi, paymentSettingsApi, budgetSettingsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

/** Возвращает текущий учебный год в формате "2025-2026" */
function getCurrentAcademicYear(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'faculties' | 'payment' | 'budget'>('faculties');

  // Data
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Faculty form
  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultyShort, setNewFacultyShort] = useState('');
  const [editingFacultyId, setEditingFacultyId] = useState<number | null>(null);
  const [editFacultyName, setEditFacultyName] = useState('');
  const [editFacultyShort, setEditFacultyShort] = useState('');

  // Budget settings
  const [budgetSettings, setBudgetSettings] = useState<BudgetSettings>({
    default_budget_percent: '1',
    default_stipend_amount: '',
  });
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetSaved, setBudgetSaved] = useState(false);

  // Payment settings form — текущий год по умолчанию
  const [newAcademicYear, setNewAcademicYear] = useState(getCurrentAcademicYear());
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
      const [facultyData, settingsData, budgetData] = await Promise.all([
        facultyApi.getAll(false),
        paymentSettingsApi.getAll(),
        budgetSettingsApi.get().catch(() => ({ default_budget_percent: '1', default_stipend_amount: '' })),
      ]);
      setFaculties(facultyData);
      setPaymentSettings(settingsData);
      setBudgetSettings(budgetData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ============ Faculty (Деректорат) handlers ============

  const handleAddFaculty = async () => {
    if (!newFacultyName.trim()) return;
    try {
      await facultyApi.create({
        name: newFacultyName,
        short_name: newFacultyShort || undefined,
      });
      setNewFacultyName('');
      setNewFacultyShort('');
      setFaculties(await facultyApi.getAll(false));
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
      setFaculties(await facultyApi.getAll(false));
    } catch (error) {
      console.error('Failed to update faculty:', error);
    }
  };

  const handleToggleFacultyActive = async (faculty: Faculty) => {
    try {
      await facultyApi.update(faculty.id, { is_active: !faculty.is_active });
      setFaculties(await facultyApi.getAll(false));
    } catch (error) {
      console.error('Failed to toggle faculty:', error);
    }
  };

  const handleDeleteFaculty = async (faculty: Faculty) => {
    if (!confirm(`Удалить деректорат "${faculty.name}"?\nЭто действие деактивирует его и скроет из всех выпадающих списков.`)) return;
    try {
      await facultyApi.delete(faculty.id);
      setFaculties(await facultyApi.getAll(false));
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Ошибка при удалении деректората');
    }
  };

  // ============ Payment Settings handlers ============

  const handleAddPaymentSettings = async () => {
    if (!newAcademicYear || !newFallAmount || !newSpringAmount) return;
    try {
      await paymentSettingsApi.create({
        academic_year: newAcademicYear,
        currency: newCurrency,
        fall_amount: Number(newFallAmount),
        spring_amount: Number(newSpringAmount),
      });
      setNewAcademicYear(getCurrentAcademicYear());
      setNewFallAmount('');
      setNewSpringAmount('');
      setPaymentSettings(await paymentSettingsApi.getAll());
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Ошибка при создании настроек');
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
      setPaymentSettings(await paymentSettingsApi.getAll());
    } catch (error) {
      console.error('Failed to update payment settings:', error);
    }
  };

  const handleDeletePaymentSettings = async (id: number) => {
    if (!confirm('Удалить настройки оплаты?')) return;
    try {
      await paymentSettingsApi.delete(id);
      setPaymentSettings(await paymentSettingsApi.getAll());
    } catch (error) {
      console.error('Failed to delete payment settings:', error);
    }
  };

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(amount);

  // Academic year options (current ± 2)
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const baseYear = currentMonth >= 9 ? currentYear : currentYear - 1;
  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = baseYear - 2 + i;
    return `${y}-${y + 1}`;
  });

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
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-dark">Настройки системы</h1>
        <p className="text-accent mt-1">Управление справочниками и настройками — СПБГУПТД</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {([
          { key: 'faculties', label: 'Деректораты' },
          { key: 'payment', label: 'Оплата' },
          { key: 'budget', label: 'Бюджетники' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 md:px-4 py-2 rounded-lg font-medium text-sm md:text-base transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-primary text-white shadow-md shadow-primary/25'
                : 'bg-light-dark text-accent hover:bg-light-darker active:bg-light-darker'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== Деректораты Tab ===== */}
      {activeTab === 'faculties' && (
        <div className="card animate-fade-in-fast">
          <h2 className="text-base md:text-lg font-semibold text-dark mb-4">Деректораты</h2>
          <p className="text-sm text-accent mb-4">
            Например: ИИТА — Институт информационных технологий и автоматизации
          </p>

          {/* Add Form */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="text"
              value={newFacultyName}
              onChange={(e) => setNewFacultyName(e.target.value)}
              placeholder="Полное название деректората"
              className="input flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAddFaculty()}
            />
            <input
              type="text"
              value={newFacultyShort}
              onChange={(e) => setNewFacultyShort(e.target.value)}
              placeholder="Аббр."
              className="input w-full sm:w-24"
              onKeyDown={(e) => e.key === 'Enter' && handleAddFaculty()}
            />
            <button onClick={handleAddFaculty} className="btn-primary w-full sm:w-auto justify-center">
              + Добавить
            </button>
          </div>

          {/* List */}
          <div className="space-y-2">
            {faculties.length === 0 && (
              <p className="text-center text-accent py-4">Нет деректоратов. Добавьте первый выше.</p>
            )}
            {faculties.map((faculty) => (
              <div
                key={faculty.id}
                className={`p-3 rounded-lg border ${
                  faculty.is_active ? 'border-light-dark' : 'border-red-200 bg-red-50/50'
                }`}
              >
                {editingFacultyId === faculty.id ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={editFacultyName}
                      onChange={(e) => setEditFacultyName(e.target.value)}
                      className="input flex-1"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editFacultyShort}
                      onChange={(e) => setEditFacultyShort(e.target.value)}
                      className="input w-full sm:w-24"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleSaveFaculty} className="btn-primary flex-1 sm:flex-none justify-center">
                        Сохранить
                      </button>
                      <button onClick={() => setEditingFacultyId(null)} className="btn-ghost flex-1 sm:flex-none justify-center">
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-dark truncate">{faculty.name}</p>
                      {faculty.short_name && (
                        <p className="text-sm text-accent">{faculty.short_name}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        faculty.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {faculty.is_active ? 'Активен' : 'Неактивен'}
                      </span>
                      <button
                        onClick={() => handleEditFaculty(faculty)}
                        className="text-primary hover:text-primary-dark text-sm py-1"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => handleToggleFacultyActive(faculty)}
                        className={`text-sm py-1 ${
                          faculty.is_active ? 'text-orange-500 hover:text-orange-600' : 'text-green-600 hover:text-green-700'
                        }`}
                      >
                        {faculty.is_active ? 'Деактив.' : 'Активир.'}
                      </button>
                      <button
                        onClick={() => handleDeleteFaculty(faculty)}
                        className="text-red-600 hover:text-red-700 text-sm py-1"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Payment Settings Tab ===== */}
      {activeTab === 'payment' && (
        <div className="card animate-fade-in-fast">
          <h2 className="text-base md:text-lg font-semibold text-dark mb-2">Настройки оплаты по семестрам</h2>
          <p className="text-accent text-sm mb-4">
            Текущий учебный год: <strong>{getCurrentAcademicYear()}</strong>
          </p>

          {/* Add Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-6 p-3 md:p-4 bg-light-dark/30 rounded-lg">
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
            </select>
            <button onClick={handleAddPaymentSettings} className="btn-primary justify-center">
              + Добавить
            </button>
          </div>

          {/* List */}
          <div className="space-y-3">
            {paymentSettings.length === 0 ? (
              <p className="text-center text-accent py-4">Нет настроек оплаты. Добавьте первый учебный год выше.</p>
            ) : (
              paymentSettings.map((settings) => (
                <div key={settings.id} className="p-3 md:p-4 rounded-lg border border-light-dark">
                  {editingSettingsId === settings.id ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      <div className="font-medium text-dark py-2">{settings.academic_year}</div>
                      <input
                        type="number"
                        value={editFallAmount}
                        onChange={(e) => setEditFallAmount(e.target.value)}
                        placeholder="Осень"
                        className="input"
                        min="0"
                        autoFocus
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
                        <button onClick={handleSavePaymentSettings} className="btn-primary flex-1 justify-center">
                          Сохранить
                        </button>
                        <button onClick={() => setEditingSettingsId(null)} className="btn-ghost justify-center">
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                        <div>
                          <p className="text-xs md:text-sm text-accent">Учебный год</p>
                          <p className="font-semibold text-dark">
                            {settings.academic_year}
                            {settings.academic_year === getCurrentAcademicYear() && (
                              <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">текущий</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs md:text-sm text-accent">Осенний семестр</p>
                          <p className="font-medium text-dark">{formatMoney(settings.fall_amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs md:text-sm text-accent">Весенний семестр</p>
                          <p className="font-medium text-dark">{formatMoney(settings.spring_amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs md:text-sm text-accent">Итого за год</p>
                          <p className="font-bold text-primary">{formatMoney(settings.total_year_amount)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 lg:ml-4">
                        <button
                          onClick={() => handleEditPaymentSettings(settings)}
                          className="text-primary hover:text-primary-dark text-sm py-1"
                        >
                          Изменить
                        </button>
                        <button
                          onClick={() => handleDeletePaymentSettings(settings.id)}
                          className="text-red-600 hover:text-red-700 text-sm py-1"
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

      {/* ===== Budget Settings Tab ===== */}
      {activeTab === 'budget' && (
        <div className="card animate-fade-in-fast">
          <h2 className="text-base md:text-lg font-semibold text-dark mb-2">Настройки для бюджетников</h2>
          <p className="text-accent text-sm mb-6">
            Шаблонные значения стипендии и процента, подставляемые при добавлении бюджетника.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-accent mb-1">
                Стипендия по умолчанию (₽)
              </label>
              <input
                type="number"
                value={budgetSettings.default_stipend_amount}
                onChange={(e) => setBudgetSettings({ ...budgetSettings, default_stipend_amount: e.target.value })}
                className="input"
                placeholder="Например: 5000"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-accent mb-1">
                Процент по умолчанию (%)
              </label>
              <input
                type="number"
                value={budgetSettings.default_budget_percent}
                onChange={(e) => setBudgetSettings({ ...budgetSettings, default_budget_percent: e.target.value })}
                className="input"
                placeholder="Например: 1"
                min="0"
                max="100"
                step="0.01"
              />
            </div>
          </div>

          {budgetSettings.default_stipend_amount && budgetSettings.default_budget_percent && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg max-w-lg">
              <p className="text-sm text-blue-800">
                При стипендии <strong>{budgetSettings.default_stipend_amount} руб.</strong> и проценте <strong>{budgetSettings.default_budget_percent}%</strong>,
                к оплате: <strong className="text-primary">
                  {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2 }).format(
                    Math.round(parseFloat(budgetSettings.default_stipend_amount) * parseFloat(budgetSettings.default_budget_percent)) / 100
                  )}
                </strong>
              </p>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={async () => {
                setBudgetSaving(true);
                setBudgetSaved(false);
                try {
                  await budgetSettingsApi.update(budgetSettings);
                  setBudgetSaved(true);
                  setTimeout(() => setBudgetSaved(false), 3000);
                } catch (error) {
                  console.error('Failed to save budget settings:', error);
                } finally {
                  setBudgetSaving(false);
                }
              }}
              disabled={budgetSaving}
              className="btn-primary disabled:opacity-50"
            >
              {budgetSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
            {budgetSaved && (
              <span className="text-green-600 text-sm animate-fade-in">Сохранено</span>
            )}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 p-3 md:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Примечание:</strong> Деактивация деректората скрывает его из выпадающих списков, но не удаляет связанные данные плательщиков.
          Полное удаление возможно только если нет привязанных плательщиков.
        </p>
      </div>
    </div>
  );
}
