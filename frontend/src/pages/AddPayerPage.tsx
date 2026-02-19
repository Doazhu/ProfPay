import { useState, useEffect, useMemo, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Faculty, PayerCreate, BudgetSettings } from '../types';
import { payerApi, facultyApi, budgetSettingsApi } from '../services/api';

/** Возвращает текущий учебный год в формате "2025-2026" */
function getCurrentAcademicYear(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

/** Пытается извлечь курс из кода группы вида "1-мд-35" */
function parseCourseFromGroup(groupCode: string): number | undefined {
  const match = groupCode.trim().match(/^(\d)/);
  if (match) {
    const c = parseInt(match[1]);
    if (c >= 1 && c <= 6) return c;
  }
  return undefined;
}

export default function AddPayerPage() {
  const navigate = useNavigate();

  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Budget defaults
  const [budgetDefaults, setBudgetDefaults] = useState<BudgetSettings>({
    default_budget_percent: '1',
    default_stipend_amount: '',
  });

  // Budget calculator state
  const [isBudget, setIsBudget] = useState(false);
  const [stipendAmount, setStipendAmount] = useState('');
  const [budgetPercent, setBudgetPercent] = useState('');

  const budgetPayment = useMemo(() => {
    const s = parseFloat(stipendAmount);
    const p = parseFloat(budgetPercent);
    if (!isNaN(s) && !isNaN(p) && s > 0 && p > 0) {
      return Math.round(s * p) / 100;
    }
    return 0;
  }, [stipendAmount, budgetPercent]);

  // Form state
  const [formData, setFormData] = useState<PayerCreate>({
    last_name: '',
    first_name: '',
    middle_name: '',
    date_of_birth: '',
    email: '',
    phone: '',
    telegram: '',
    vk: '',
    faculty_id: undefined,
    group_name: '',
    course: undefined,
    department: '',
    status: 'unpaid',
    notes: '',
  });

  useEffect(() => {
    loadFaculties();
    loadBudgetDefaults();
  }, []);

  // Auto-extract course when group_name changes
  useEffect(() => {
    if (formData.group_name && !formData.course) {
      const c = parseCourseFromGroup(formData.group_name);
      if (c) setFormData(prev => ({ ...prev, course: c }));
    }
  }, [formData.group_name]);

  const loadFaculties = async () => {
    try {
      const data = await facultyApi.getAll();
      setFaculties(data);
    } catch (error) {
      console.error('Failed to load faculties:', error);
    }
  };

  const loadBudgetDefaults = async () => {
    try {
      const data = await budgetSettingsApi.get();
      setBudgetDefaults(data);
      setBudgetPercent(data.default_budget_percent || '1');
      if (data.default_stipend_amount) {
        setStipendAmount(data.default_stipend_amount);
      }
    } catch (error) {
      console.error('Failed to load budget defaults:', error);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === '' ? undefined : value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const payer = await payerApi.create({
        ...formData,
        date_of_birth: formData.date_of_birth || undefined,
        is_budget: isBudget,
        stipend_amount: isBudget && stipendAmount ? Number(stipendAmount) : undefined,
        budget_percent: isBudget && budgetPercent ? Number(budgetPercent) : undefined,
        faculty_id: formData.faculty_id ? Number(formData.faculty_id) : undefined,
        group_name: formData.group_name || undefined,
        course: formData.course ? Number(formData.course) : undefined,
        department: formData.department || undefined,
      });
      navigate(`/payers/${payer.id}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Ошибка при создании плательщика');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark">Добавить плательщика</h1>
        <p className="text-accent mt-1">Регистрация нового члена профсоюза — СПБГУПТД</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card">
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm animate-scale-in">
            {error}
          </div>
        )}

        {/* Personal Info */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-dark mb-4">Личные данные</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-accent mb-1">Фамилия *</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-accent mb-1">Имя *</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-accent mb-1">Отчество</label>
              <input
                type="text"
                name="middle_name"
                value={formData.middle_name || ''}
                onChange={handleChange}
                className="input"
              />
            </div>
          </div>
          <div className="mt-4" style={{ maxWidth: '220px' }}>
            <label className="block text-sm font-medium text-accent mb-1">Дата рождения</label>
            <input
              type="date"
              name="date_of_birth"
              value={formData.date_of_birth || ''}
              onChange={handleChange}
              className="input"
            />
          </div>
        </div>

        {/* Contact Info */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-dark mb-4">Контактные данные</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-accent mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email || ''}
                onChange={handleChange}
                className="input"
                placeholder="student@spbguptd.ru"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-accent mb-1">Телефон</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone || ''}
                onChange={handleChange}
                className="input"
                placeholder="+7 (999) 123-45-67"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-accent mb-1">Telegram</label>
              <input
                type="text"
                name="telegram"
                value={formData.telegram || ''}
                onChange={handleChange}
                className="input"
                placeholder="@username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-accent mb-1">VK</label>
              <input
                type="text"
                name="vk"
                value={formData.vk || ''}
                onChange={handleChange}
                className="input"
                placeholder="vk.com/username"
              />
            </div>
          </div>
        </div>

        {/* University Info */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-dark mb-4">Данные обучения</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Деректорат (бывший факультет) */}
            <div>
              <label className="block text-sm font-medium text-accent mb-1">Деректорат</label>
              <select
                name="faculty_id"
                value={formData.faculty_id || ''}
                onChange={handleChange}
                className="input"
              >
                <option value="">Не указан</option>
                {faculties.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.short_name ? `${f.short_name} — ${f.name}` : f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Кафедра (опционально) */}
            <div>
              <label className="block text-sm font-medium text-accent mb-1">
                Кафедра <span className="text-accent/60 font-normal">(необязательно)</span>
              </label>
              <input
                type="text"
                name="department"
                value={formData.department || ''}
                onChange={handleChange}
                className="input"
                placeholder="Например: ЦИАТ"
              />
            </div>

            {/* Группа — свободный ввод */}
            <div>
              <label className="block text-sm font-medium text-accent mb-1">
                Группа
                <span className="text-xs text-accent/60 ml-1 font-normal">(формат: 1-мд-35)</span>
              </label>
              <input
                type="text"
                name="group_name"
                value={formData.group_name || ''}
                onChange={handleChange}
                className="input"
                placeholder="Например: 1-мд-35"
              />
              <p className="text-xs text-accent/70 mt-1">Курс определяется автоматически из кода группы</p>
            </div>

            {/* Курс */}
            <div>
              <label className="block text-sm font-medium text-accent mb-1">Курс</label>
              <input
                type="number"
                name="course"
                value={formData.course || ''}
                onChange={handleChange}
                className="input"
                placeholder="1–6"
                min="1"
                max="6"
              />
            </div>

            {/* Статус оплаты — только 2 варианта */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-accent mb-2">Статус оплаты</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="unpaid"
                    checked={formData.status === 'unpaid'}
                    onChange={handleChange}
                    className="w-4 h-4 text-red-600"
                  />
                  <span className="text-dark">Не оплачено</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="paid"
                    checked={formData.status === 'paid'}
                    onChange={handleChange}
                    className="w-4 h-4 text-green-600"
                  />
                  <span className="text-dark">Оплачено</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Budget Student */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-dark mb-4">Форма обучения</h2>
          <label className="flex items-center gap-3 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={isBudget}
              onChange={(e) => setIsBudget(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-dark font-medium">Бюджетник</span>
            <span className="text-accent text-sm">(учится на бюджетной основе)</span>
          </label>

          {isBudget && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg animate-fade-in">
              <p className="text-sm text-blue-800 mb-3">
                Бюджетник платит процент от стипендии. Укажите данные или используйте шаблонные значения.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-accent mb-1">Стипендия</label>
                  <input
                    type="number"
                    value={stipendAmount}
                    onChange={(e) => setStipendAmount(e.target.value)}
                    className="input"
                    placeholder={budgetDefaults.default_stipend_amount || '0'}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-accent mb-1">Процент (%)</label>
                  <input
                    type="number"
                    value={budgetPercent}
                    onChange={(e) => setBudgetPercent(e.target.value)}
                    className="input"
                    placeholder={budgetDefaults.default_budget_percent || '1'}
                    min="0"
                    max="100"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-accent mb-1">К оплате</label>
                  <div className="input bg-white flex items-center">
                    <span className={`font-bold text-lg ${budgetPayment > 0 ? 'text-primary' : 'text-accent'}`}>
                      {budgetPayment > 0
                        ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2 }).format(budgetPayment)
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
              {budgetDefaults.default_stipend_amount && (
                <button
                  type="button"
                  onClick={() => {
                    setStipendAmount(budgetDefaults.default_stipend_amount);
                    setBudgetPercent(budgetDefaults.default_budget_percent);
                  }}
                  className="mt-3 text-sm text-blue-700 hover:text-blue-900 underline"
                >
                  Заполнить шаблонными значениями (стипендия: {budgetDefaults.default_stipend_amount} / процент: {budgetDefaults.default_budget_percent}%)
                </button>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-accent mb-1">Примечания</label>
          <textarea
            name="notes"
            value={formData.notes || ''}
            onChange={handleChange}
            className="input min-h-[100px]"
            placeholder="Дополнительная информация..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-light-dark">
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost">
            Отмена
          </button>
          <button type="submit" disabled={isLoading} className="btn-primary disabled:opacity-50">
            {isLoading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
}
