import { useState, FormEvent } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { extractErrorMessage } from '../services/api';
import { safeRedirectPath } from '../utils/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const justReset = searchParams.get('reset') === '1';

  // Адрес возврата приходит из адресной строки — пропускаем только
  // относительные пути внутри приложения (см. utils/navigation.ts).
  const from = safeRedirectPath((location.state as { from?: { pathname?: string } })?.from?.pathname);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login({ username, password });
      navigate(from, { replace: true });
    } catch (err) {
      // Сообщение с сервера полезнее общей фразы: в нём остаток попыток
      // и время блокировки.
      setError(extractErrorMessage(err, 'Неверный логин или пароль'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-light px-4 py-8">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-white font-semibold text-sm">
              P
            </div>
            <h1 className="text-xl font-semibold text-dark">ProfPay</h1>
          </div>
          <p className="text-sm text-accent">Учёт плательщиков профсоюзных взносов</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-dark mb-4">Вход</h2>

          {justReset && (
            <div className="mb-4 px-3 py-2 rounded border border-[#C6E3D4] bg-[#EDF6F1] text-state-paid text-sm">
              Пароль изменён. Войдите с новым паролем.
            </div>
          )}

          {error && (
            <div className="mb-4 px-3 py-2 rounded border border-[#EFCFCC] bg-[#FBEEED] text-state-unpaid text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-accent mb-1">
                Логин или почта
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="admin"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-accent">
                  Пароль
                </label>
                <Link to="/forgot-password" className="text-xs text-primary hover:text-primary-dark">
                  Забыли пароль?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary btn-lg w-full"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Вход...
                </span>
              ) : (
                'Войти'
              )}
            </button>
          </form>

          <p className="hint mt-5 text-center">
            Нет доступа? Обратитесь к администратору профкома
          </p>
        </div>
      </div>
    </div>
  );
}
