import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { Payer, Payment, Faculty, StudentGroup } from '../types';
import { payerApi, paymentApi, facultyApi, groupApi, budgetSettingsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Status Badge
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    paid: { label: 'Оплачено', className: 'bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm' },
    partial: { label: 'Частично', className: 'bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm' },
    unpaid: { label: 'Не оплачено', className: 'bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm' },
    exempt: { label: 'Освобождён', className: 'bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm' },
  };
  const { label, className } = config[status] || config.unpaid;
  return <span className={className}>{label}</span>;
}

export default function PayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = useAuth();

  const [payer, setPayer] = useState<Payer | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  // Budget calculator
  const [editIsBudget, setEditIsBudget] = useState(false);
  const [editStipend, setEditStipend] = useState('');
  const [editBudgetPercent, setEditBudgetPercent] = useState('');

  const editBudgetPayment = useMemo(() => {
    const s = parseFloat(editStipend);
    const p = parseFloat(editBudgetPercent);
    if (!isNaN(s) && !isNaN(p) && s > 0 && p > 0) {
      return Math.round(s * p) / 100;
    }
    return 0;
  }, [editStipend, editBudgetPercent]);

  // Edit form
  const [editData, setEditData] = useState({
    last_name: '',
    first_name: '',
    middle_name: '',
    date_of_birth: '',
    email: '',
    phone: '',
    telegram: '',
    vk: '',
    faculty_id: undefined as number | undefined,
    group_id: undefined as number | undefined,
    course: undefined as number | undefined,
    notes: '',
  });

  // Payment form
  const [newPayment, setNewPayment] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    academic_year: '',
    semester: '' as 'fall' | 'spring' | '',
    payment_method: '',
    notes: '',
  });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [payerData, paymentsData, facultyData, groupData, budgetData] = await Promise.all([
        payerApi.getById(Number(id)),
        paymentApi.getByPayer(Number(id)),
        facultyApi.getAll(false),
        groupApi.getAll(undefined, false),
        budgetSettingsApi.get().catch(() => ({ default_budget_percent: '1', default_stipend_amount: '' })),
      ]);
      setPayer(payerData);
      setPayments(paymentsData);
      setFaculties(facultyData);
      setGroups(groupData);
      // Initialize budget edit fields
      setEditIsBudget(payerData.is_budget);
      setEditStipend(payerData.stipend_amount ? String(payerData.stipend_amount) : '');
      setEditBudgetPercent(payerData.budget_percent ? String(payerData.budget_percent) : budgetData.default_budget_percent || '1');

      // Initialize edit form
      setEditData({
        last_name: payerData.last_name,
        first_name: payerData.first_name,
        middle_name: payerData.middle_name || '',
        date_of_birth: payerData.date_of_birth || '',
        email: payerData.email || '',
        phone: payerData.phone || '',
        telegram: payerData.telegram || '',
        vk: payerData.vk || '',
        faculty_id: payerData.faculty_id || undefined,
        group_id: payerData.group_id || undefined,
        course: payerData.course || undefined,
        notes: payerData.notes || '',
      });
    } catch (error) {
      console.error('Failed to load payer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!id || !payer) return;
    try {
      const updated = await payerApi.update(Number(id), {
        ...editData,
        date_of_birth: editData.date_of_birth || undefined,
        is_budget: editIsBudget,
        stipend_amount: editIsBudget && editStipend ? Number(editStipend) : undefined,
        budget_percent: editIsBudget && editBudgetPercent ? Number(editBudgetPercent) : undefined,
        faculty_id: editData.faculty_id || undefined,
        group_id: editData.group_id || undefined,
        course: editData.course || undefined,
      });
      setPayer(updated);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update payer:', error);
    }
  };

  const handleAddPayment = async () => {
    if (!id || !newPayment.amount) return;
    try {
      const created = await paymentApi.create({
        payer_id: Number(id),
        amount: Number(newPayment.amount),
        payment_date: newPayment.payment_date,
        academic_year: newPayment.academic_year || undefined,
        semester: newPayment.semester || undefined,
        payment_method: newPayment.payment_method || undefined,
        notes: newPayment.notes || undefined,
      });
      setPayments([created, ...payments]);
      setShowPaymentForm(false);
      setNewPayment({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        academic_year: '',
        semester: '',
        payment_method: '',
        notes: '',
      });
      // Reload payer to get updated total_paid
      const updatedPayer = await payerApi.getById(Number(id));
      setPayer(updatedPayer);
    } catch (error) {
      console.error('Failed to add payment:', error);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm('Удалить платёж?')) return;
    try {
      await paymentApi.delete(paymentId);
      setPayments(payments.filter(p => p.id !== paymentId));
      // Reload payer to get updated total_paid
      if (id) {
        const updatedPayer = await payerApi.getById(Number(id));
        setPayer(updatedPayer);
      }
    } catch (error) {
      console.error('Failed to delete payment:', error);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU');
  };

  const getFacultyName = (id: number | null) => {
    if (!id) return 'Не указан';
    const faculty = faculties.find(f => f.id === id);
    return faculty?.name || 'Не указан';
  };

  const getGroupName = (id: number | null) => {
    if (!id) return 'Не указана';
    const group = groups.find(g => g.id === id);
    return group?.name || 'Не указана';
  };

  // Generate academic year options
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const year = currentYear - 2 + i;
    return `${year}-${year + 1}`;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 animate-fade-in">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!payer) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <p className="text-lg text-accent">Плательщик не найден</p>
        <Link to="/payers" className="text-primary hover:underline mt-4 inline-block transition-colors duration-150">
          Вернуться к списку
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="text-accent hover:text-dark mb-2 flex items-center gap-1 text-sm transition-colors duration-150"
          >
            <span>←</span> Назад
          </button>
          <h1 className="text-2xl font-bold text-dark">{payer.full_name}</h1>
        </div>
        <StatusBadge status={payer.status} />
      </div>

      {/* Main Card */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-dark">Информация о плательщике</h2>
          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-primary hover:text-primary-dark text-sm"
            >
              Редактировать
            </button>
          )}
        </div>

        {isEditing ? (
          // Edit Form
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-accent mb-1">Фамилия</label>
                <input
                  type="text"
                  value={editData.last_name}
                  onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm text-accent mb-1">Имя</label>
                <input
                  type="text"
                  value={editData.first_name}
                  onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm text-accent mb-1">Отчество</label>
                <input
                  type="text"
                  value={editData.middle_name}
                  onChange={(e) => setEditData({ ...editData, middle_name: e.target.value })}
                  className="input"
                />
              </div>
            </div>
            <div style={{ maxWidth: '220px' }}>
              <label className="block text-sm text-accent mb-1">Дата рождения</label>
              <input
                type="date"
                value={editData.date_of_birth}
                onChange={(e) => setEditData({ ...editData, date_of_birth: e.target.value })}
                className="input"
              />
            </div>

            {/* Budget section */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsBudget}
                  onChange={(e) => setEditIsBudget(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-dark font-medium">Бюджетник</span>
              </label>
              {editIsBudget && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm text-accent mb-1">Стипендия</label>
                      <input
                        type="number"
                        value={editStipend}
                        onChange={(e) => setEditStipend(e.target.value)}
                        className="input"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-accent mb-1">Процент (%)</label>
                      <input
                        type="number"
                        value={editBudgetPercent}
                        onChange={(e) => setEditBudgetPercent(e.target.value)}
                        className="input"
                        min="0"
                        max="100"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-accent mb-1">К оплате</label>
                      <div className="input bg-white flex items-center">
                        <span className={`font-bold ${editBudgetPayment > 0 ? 'text-primary' : 'text-accent'}`}>
                          {editBudgetPayment > 0
                            ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2 }).format(editBudgetPayment)
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-accent mb-1">Email</label>
                <input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm text-accent mb-1">Телефон</label>
                <input
                  type="tel"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm text-accent mb-1">Telegram</label>
                <input
                  type="text"
                  value={editData.telegram}
                  onChange={(e) => setEditData({ ...editData, telegram: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm text-accent mb-1">VK</label>
                <input
                  type="text"
                  value={editData.vk}
                  onChange={(e) => setEditData({ ...editData, vk: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-accent mb-1">Факультет</label>
                <select
                  value={editData.faculty_id || ''}
                  onChange={(e) => setEditData({ ...editData, faculty_id: e.target.value ? Number(e.target.value) : undefined })}
                  className="input"
                >
                  <option value="">Не указан</option>
                  {faculties.filter(f => f.is_active).map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-accent mb-1">Группа</label>
                <select
                  value={editData.group_id || ''}
                  onChange={(e) => setEditData({ ...editData, group_id: e.target.value ? Number(e.target.value) : undefined })}
                  className="input"
                >
                  <option value="">Не указана</option>
                  {groups.filter(g => g.is_active).map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-accent mb-1">Курс</label>
                <select
                  value={editData.course || ''}
                  onChange={(e) => setEditData({ ...editData, course: e.target.value ? Number(e.target.value) : undefined })}
                  className="input"
                >
                  <option value="">Не указан</option>
                  {[1, 2, 3, 4, 5, 6].map((c) => (
                    <option key={c} value={c}>{c} курс</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-accent mb-1">Примечания</label>
              <textarea
                value={editData.notes}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                className="input min-h-[80px]"
              />
            </div>

            <div className="flex gap-2 pt-4 border-t border-light-dark">
              <button onClick={handleSaveEdit} className="btn-primary">
                Сохранить
              </button>
              <button onClick={() => setIsEditing(false)} className="btn-ghost">
                Отмена
              </button>
            </div>
          </div>
        ) : (
          // Display Info
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-accent mb-3">Личные данные</h3>
              <div className="space-y-2">
                <p className="flex items-center gap-2">
                  <span className="text-accent">Дата рождения:</span>
                  <span className="text-dark">{payer.date_of_birth ? formatDate(payer.date_of_birth) : '—'}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-accent">Email:</span>
                  <span className="text-dark">{payer.email || '—'}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-accent">Телефон:</span>
                  <span className="text-dark">{payer.phone || '—'}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-accent">Telegram:</span>
                  <span className="text-dark">{payer.telegram || '—'}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-accent">VK:</span>
                  <span className="text-dark">{payer.vk || '—'}</span>
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-accent mb-3">Обучение</h3>
              <div className="space-y-2">
                <p className="flex items-center gap-2">
                  <span className="text-accent">Факультет:</span>
                  <span className="text-dark">{getFacultyName(payer.faculty_id)}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-accent">Группа:</span>
                  <span className="text-dark">{getGroupName(payer.group_id)}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-accent">Курс:</span>
                  <span className="text-dark">{payer.course ? `${payer.course} курс` : '—'}</span>
                </p>
              </div>
            </div>

            {payer.is_budget && (
              <div className="col-span-2">
                <h3 className="text-sm font-medium text-accent mb-3">Бюджетник</h3>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex flex-wrap gap-6">
                    <p className="flex items-center gap-2">
                      <span className="text-accent">Стипендия:</span>
                      <span className="text-dark font-medium">
                        {payer.stipend_amount
                          ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(payer.stipend_amount)
                          : '—'}
                      </span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-accent">Процент:</span>
                      <span className="text-dark font-medium">{payer.budget_percent ? `${payer.budget_percent}%` : '—'}</span>
                    </p>
                    {payer.stipend_amount && payer.budget_percent && (
                      <p className="flex items-center gap-2">
                        <span className="text-accent">К оплате:</span>
                        <span className="text-primary font-bold">
                          {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2 }).format(
                            Math.round(payer.stipend_amount * payer.budget_percent) / 100
                          )}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {payer.notes && (
              <div className="col-span-2">
                <h3 className="text-sm font-medium text-accent mb-2">Примечания</h3>
                <p className="text-dark bg-light-dark/30 p-3 rounded-lg">{payer.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payments Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-dark">История платежей</h2>
            <p className="text-accent text-sm">
              Всего оплачено: <span className="font-bold text-primary">{formatMoney(payer.total_paid)}</span>
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowPaymentForm(!showPaymentForm)}
              className="btn-primary"
            >
              + Добавить платёж
            </button>
          )}
        </div>

        {/* Payment Form */}
        {showPaymentForm && (
          <div className="mb-6 p-4 bg-light-dark/30 rounded-lg animate-slide-in">
            <h3 className="font-medium text-dark mb-3">Новый платёж</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-accent mb-1">Сумма *</label>
                <input
                  type="number"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                  placeholder="0"
                  className="input"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm text-accent mb-1">Дата платежа</label>
                <input
                  type="date"
                  value={newPayment.payment_date}
                  onChange={(e) => setNewPayment({ ...newPayment, payment_date: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm text-accent mb-1">Способ оплаты</label>
                <select
                  value={newPayment.payment_method}
                  onChange={(e) => setNewPayment({ ...newPayment, payment_method: e.target.value })}
                  className="input"
                >
                  <option value="">Не указан</option>
                  <option value="cash">Наличные</option>
                  <option value="card">Карта</option>
                  <option value="transfer">Перевод</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-accent mb-1">Учебный год</label>
                <select
                  value={newPayment.academic_year}
                  onChange={(e) => setNewPayment({ ...newPayment, academic_year: e.target.value })}
                  className="input"
                >
                  <option value="">Не указан</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-accent mb-1">Семестр</label>
                <select
                  value={newPayment.semester}
                  onChange={(e) => setNewPayment({ ...newPayment, semester: e.target.value as 'fall' | 'spring' | '' })}
                  className="input"
                >
                  <option value="">Не указан</option>
                  <option value="fall">Осенний</option>
                  <option value="spring">Весенний</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-accent mb-1">Примечание</label>
                <input
                  type="text"
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                  className="input"
                  placeholder="Примечание..."
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleAddPayment} className="btn-primary">
                Добавить
              </button>
              <button onClick={() => setShowPaymentForm(false)} className="btn-ghost">
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* Payments List */}
        {payments.length === 0 ? (
          <p className="text-center text-accent py-8">Нет платежей</p>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 bg-light-dark/30 rounded-lg transition-all duration-150 hover:bg-light-dark/50"
              >
                <div className="flex items-center gap-4">
                  <div className="text-lg font-bold text-primary">
                    {formatMoney(payment.amount)}
                  </div>
                  <div className="text-sm text-accent">
                    {formatDate(payment.payment_date)}
                  </div>
                  {payment.academic_year && (
                    <div className="text-sm text-accent">
                      {payment.academic_year}
                      {payment.semester && ` (${payment.semester === 'fall' ? 'осень' : 'весна'})`}
                    </div>
                  )}
                  {payment.payment_method && (
                    <div className="text-xs bg-white px-2 py-1 rounded text-accent">
                      {payment.payment_method === 'cash' ? 'Наличные' :
                       payment.payment_method === 'card' ? 'Карта' : 'Перевод'}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleDeletePayment(payment.id)}
                    className="text-red-600 hover:text-red-700 text-sm transition-colors duration-150"
                  >
                    Удалить
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
