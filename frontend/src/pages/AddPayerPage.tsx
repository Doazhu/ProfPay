import { useState, useEffect, useMemo, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Faculty, StudentGroup, PayerCreate, BudgetSettings } from '../types';
import { payerApi, facultyApi, groupApi, budgetSettingsApi } from '../services/api';

export default function AddPayerPage() {
  const navigate = useNavigate();

  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
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
    group_id: undefined,
    course: undefined,
    status: 'unpaid',
    notes: '',
  });

  useEffect(() => {
    loadFaculties();
    loadAllGroups();
    loadBudgetDefaults();
  }, []);

  useEffect(() => {
    if (formData.faculty_id) {
      loadGroups(formData.faculty_id);
    }
  }, [formData.faculty_id]);

  const loadFaculties = async () => {
    try {
      const data = await facultyApi.getAll();
      setFaculties(data);
    } catch (error) {
      console.error('Failed to load faculties:', error);
    }
  };

  const loadAllGroups = async () => {
    try {
      const data = await groupApi.getAll();
      setGroups(data);
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const loadGroups = async (facultyId: number) => {
    try {
      const data = await groupApi.getAll(facultyId);
      setGroups(data);
    } catch (error) {
      console.error('Failed to load groups:', error);
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
        group_id: formData.group_id ? Number(formData.group_id) : undefined,
        course: formData.course ? Number(formData.course) : undefined,
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
        <p className="text-accent mt-1">Регистрация нового члена профсоюза</p>
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
              <label className="block text-sm font-medium text-accent mb-1">
                Фамилия *
              </label>
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
              <label className="block text-sm font-medium text-accent mb-1">
                Имя *
              </label>
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
              <label className="block text-sm font-medium text-accent mb-1">
                Отчество
              </label>
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
            <label className="block text-sm font-medium text-accent mb-1">
              Дата рождения
            </label>
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
              <label className="block text-sm font-medium text-accent mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email || ''}
                onChange={handleChange}
                className="input"
                placeholder="student@university.ru"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-accent mb-1">
                Телефон
              </label>
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
              <label className="block text-sm font-medium text-accent mb-1">
                Telegram
              </label>
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
              <label className="block text-sm font-medium text-accent mb-1">
                VK
              </label>
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
            <div>
              <label className="block text-sm font-medium text-accent mb-1">
                Факультет
              </label>
              <select
                name="faculty_id"
                value={formData.faculty_id || ''}
                onChange={handleChange}
                className="input"
              >
                <option value="">Не указан</option>
                {faculties.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-accent mb-1">
                Группа
              </label>
              <select
                name="group_id"
                value={formData.group_id || ''}
                onChange={handleChange}
                className="input"
              >
                <option value="">Не указана</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} {g.course ? `(${g.course} курс)` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-accent mb-1">
                Курс
              </label>
              <select
                name="course"
                value={formData.course || ''}
                onChange={handleChange}
                className="input"
              >
                <option value="">Не указан</option>
                {[1, 2, 3, 4, 5, 6].map((c) => (
                  <option key={c} value={c}>{c} курс</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-accent mb-1">
                Статус оплаты
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="input"
              >
                <option value="unpaid">Не оплачено</option>
                <option value="partial">Частично оплачено</option>
                <option value="paid">Оплачено</option>
                <option value="exempt">Освобождён от оплаты</option>
              </select>
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
                  <label className="block text-sm font-medium text-accent mb-1">
                    Стипендия
                  </label>
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
                  <label className="block text-sm font-medium text-accent mb-1">
                    Процент (%)
                  </label>
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
                  <label className="block text-sm font-medium text-accent mb-1">
                    К оплате
                  </label>
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
          <label className="block text-sm font-medium text-accent mb-1">
            Примечания
          </label>
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
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-ghost"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary disabled:opacity-50"
          >
            {isLoading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
}
