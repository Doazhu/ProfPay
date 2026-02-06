import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Faculty, StudentGroup, PayerCreate } from '../types';
import { payerApi, facultyApi, groupApi } from '../services/api';

export default function AddPayerPage() {
  const navigate = useNavigate();

  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
