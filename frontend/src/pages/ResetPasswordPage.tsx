import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi, extractErrorMessage } from '../services/api';

/** Установка нового пароля по токену из письма. */
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 8 && password === confirm && !isLoading;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await authApi.confirmPasswordReset(token, password);
      navigate('/login?reset=1');
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось изменить пароль'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light px-4">
        <div className="w-full max-w-sm card">
          <h1 className="text-lg font-semibold text-dark mb-2">Ссылка неполная</h1>
          <p className="text-sm text-accent">
            В адресе нет кода восстановления. Откройте ссылку из письма целиком
            или запросите новую.
          </p>
          <Link to="/forgot-password" className="btn-primary w-full mt-4">
            Запросить новую ссылку
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-light px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-dark mb-1">Новый пароль</h1>
        <p className="text-sm text-accent mb-6">Придумайте пароль не короче 8 символов.</p>

        <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
          {error && (
            <div className="px-3 py-2 rounded border border-[#EFCFCC] bg-[#FBEEED] text-state-unpaid text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="password" className="label">Новый пароль</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`input ${tooShort ? 'input-error' : ''}`}
              autoComplete="new-password"
              required
              autoFocus
            />
            {tooShort && <p className="hint text-state-unpaid">Минимум 8 символов</p>}
          </div>

          <div>
            <label htmlFor="confirm" className="label">Повторите пароль</label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`input ${mismatch ? 'input-error' : ''}`}
              autoComplete="new-password"
              required
            />
            {mismatch && <p className="hint text-state-unpaid">Пароли не совпадают</p>}
          </div>

          <button type="submit" disabled={!canSubmit} className="btn-primary w-full">
            {isLoading ? 'Сохраняем…' : 'Сохранить пароль'}
          </button>
        </form>
      </div>
    </div>
  );
}
