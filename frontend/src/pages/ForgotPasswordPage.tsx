import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi, extractErrorMessage } from '../services/api';

/**
 * Запрос ссылки восстановления.
 *
 * Ответ одинаковый независимо от того, есть такой адрес в системе или нет —
 * иначе форма превращается в способ проверить, заведён ли конкретный человек.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await authApi.requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось отправить письмо'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-light px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-dark">Восстановление пароля</h1>
          <p className="text-sm text-accent mt-1">
            Пришлём ссылку для смены пароля на почту, указанную в вашей учётной записи.
          </p>
        </div>

        {sent ? (
          <div className="card">
            <p className="text-sm text-dark">
              Если такой адрес есть в системе, письмо со ссылкой уже отправлено.
              Проверьте почту, включая папку «Спам».
            </p>
            <p className="hint mt-2">Ссылка действует 30 минут и сработает один раз.</p>
            <Link to="/login" className="btn-outline w-full mt-4">Вернуться ко входу</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
            {error && (
              <div className="px-3 py-2 rounded border border-[#EFCFCC] bg-[#FBEEED] text-state-unpaid text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="label">Электронная почта</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                autoComplete="email"
                required
                autoFocus
              />
            </div>

            <button type="submit" disabled={isLoading || !email.trim()} className="btn-primary w-full">
              {isLoading ? 'Отправляем…' : 'Отправить ссылку'}
            </button>

            <Link to="/login" className="text-sm text-primary hover:text-primary-dark text-center">
              Вспомнили пароль? Войти
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
