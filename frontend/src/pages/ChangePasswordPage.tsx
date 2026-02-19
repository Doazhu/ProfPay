import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Новый пароль должен быть не менее 8 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Новый пароль и подтверждение не совпадают');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Новый пароль совпадает со старым');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка при смене пароля');
    } finally {
      setIsLoading(false);
    }
  };

  const EyeIcon = ({ show }: { show: boolean }) => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {show ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      )}
    </svg>
  );

  const PasswordField = ({
    label, value, onChange, show, onToggle, placeholder,
  }: {
    label: string; value: string; onChange: (v: string) => void;
    show: boolean; onToggle: () => void; placeholder?: string;
  }) => (
    <div>
      <label className="block text-sm font-medium text-accent mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          className="input pr-10"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-accent hover:text-dark transition-colors"
          tabIndex={-1}
        >
          <EyeIcon show={show} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in max-w-md mx-auto">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-dark flex items-center gap-2">
          <svg className="w-6 h-6 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          Смена пароля
        </h1>
        <p className="text-accent mt-1">Введите текущий и новый пароль</p>
      </div>

      {success ? (
        <div className="card text-center py-10 animate-scale-in">
          <svg className="w-16 h-16 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-semibold text-dark mb-1">Пароль успешно изменён</p>
          <p className="text-accent text-sm mb-6">Используйте новый пароль при следующем входе</p>
          <button onClick={() => navigate(-1)} className="btn-primary">
            Вернуться назад
          </button>
        </div>
      ) : (
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField
              label="Текущий пароль"
              value={currentPassword}
              onChange={setCurrentPassword}
              show={showCurrent}
              onToggle={() => setShowCurrent(v => !v)}
              placeholder="Введите текущий пароль"
            />
            <PasswordField
              label="Новый пароль"
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              onToggle={() => setShowNew(v => !v)}
              placeholder="Минимум 8 символов"
            />
            <PasswordField
              label="Подтверждение нового пароля"
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirm}
              onToggle={() => setShowConfirm(v => !v)}
              placeholder="Повторите новый пароль"
            />

            {/* Password strength hint */}
            {newPassword && (
              <div className="text-xs text-accent space-y-1">
                <p className={newPassword.length >= 8 ? 'text-green-600' : 'text-red-500'}>
                  {newPassword.length >= 8 ? '✓' : '✗'} Не менее 8 символов
                </p>
                <p className={/[A-Z]/.test(newPassword) ? 'text-green-600' : 'text-accent'}>
                  {/[A-Z]/.test(newPassword) ? '✓' : '○'} Заглавная буква (рекомендуется)
                </p>
                <p className={/\d/.test(newPassword) ? 'text-green-600' : 'text-accent'}>
                  {/\d/.test(newPassword) ? '✓' : '○'} Цифра (рекомендуется)
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
                className="btn-primary flex-1 justify-center disabled:opacity-50"
              >
                {isLoading ? 'Сохранение...' : 'Сменить пароль'}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn-ghost"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-xs text-yellow-800">
          <strong>Важно:</strong> После смены пароля повторный вход потребует использования нового пароля.
          Смена пароля также перешифровывает ключ доступа к данным.
        </p>
      </div>
    </div>
  );
}
