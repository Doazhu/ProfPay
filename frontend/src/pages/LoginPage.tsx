import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import {
  Box, Button, Callout, Flex, Heading, Text, TextField,
} from '@radix-ui/themes';

import { useAuth } from '../contexts/AuthContext';
import { extractErrorMessage } from '../services/api';
import { safeRedirectPath } from '../utils/navigation';
import { useTheme } from '../theme/ThemeContext';
import { ThemeToggleButton } from '../components/ThemeToggle';
import LoginBackground from '../components/LoginBackground';
import PasswordField from '../components/PasswordField';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // Поле кода появляется только после того, как сервер его потребовал:
  // до входа мы не знаем, включён ли у человека второй фактор, и спрашивать
  // код у всех подряд было бы лишним шагом.
  const [totpCode, setTotpCode] = useState('');
  const [totpRequired, setTotpRequired] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login, needsTotp } = useAuth();
  const { resolvedAppearance } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Адрес возврата приходит из адресной строки — пропускаем только
  // относительные пути внутри приложения (см. utils/navigation.ts).
  const from = safeRedirectPath((location.state as { from?: { pathname?: string } })?.from?.pathname);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login({ username, password, totp_code: totpCode || undefined });
      navigate(from, { replace: true });
    } catch (err) {
      if (needsTotp(err)) {
        setTotpRequired(true);
        // Первый раз код ещё не спрашивали — не пугаем сообщением об ошибке.
        if (!totpCode) {
          setError('');
          setIsLoading(false);
          return;
        }
      }
      // Сообщение с сервера полезнее общей фразы: в нём остаток попыток
      // и время блокировки.
      setError(extractErrorMessage(err, 'Неверный логин или пароль'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <LoginBackground appearance={resolvedAppearance} />

      {/* Переключатель темы доступен до входа: если человеку светит солнце
          в окно, он должен иметь возможность включить светлую тему сразу. */}
      <Box style={{ position: 'fixed', top: 16, right: 16, zIndex: 2 }}>
        <ThemeToggleButton />
      </Box>

      <div className="login-shell">
        <div className="login-glass animate-fade-in">
          <Flex align="center" gap="3" mb="5">
            <Flex
              align="center" justify="center"
              style={{
                width: 36, height: 36,
                borderRadius: 'var(--radius-3)',
                background: 'var(--accent-9)',
                color: 'var(--accent-contrast)',
                fontWeight: 700, fontSize: 16,
                flexShrink: 0,
              }}
            >
              P
            </Flex>
            <Box>
              <Heading size="5" style={{ lineHeight: 1.1 }}>ProfPay</Heading>
              <Text as="div" size="1" color="gray">Учёт профсоюзных взносов</Text>
            </Box>
          </Flex>

          {error && (
            <Callout.Root color="red" size="1" mb="4">
              <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          )}

          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap="4">
              <Box>
                <Text as="label" htmlFor="username" size="1" weight="medium" color="gray"
                      mb="1" style={{ display: 'block' }}>
                  Логин или почта
                </Text>
                <TextField.Root
                  id="username"
                  size="3"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                  autoComplete="username"
                  autoFocus
                />
              </Box>

              <Box>
                <Text as="label" htmlFor="password" size="1" weight="medium" color="gray"
                      mb="1" style={{ display: 'block' }}>
                  Пароль
                </Text>
                <PasswordField
                  id="password"
                  size="3"
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </Box>

              {totpRequired && (
                <Box className="animate-fade-in">
                  <Text as="label" htmlFor="totp" size="1" weight="medium" color="gray"
                        mb="1" style={{ display: 'block' }}>
                    Код из приложения
                  </Text>
                  <TextField.Root
                    id="totp"
                    size="3"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="000000"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={20}
                    autoFocus
                    style={{ letterSpacing: '0.15em' }}
                  />
                  <Text as="p" size="1" color="gray" mt="1">
                    Шестизначный код из приложения-аутентификатора
                    или резервный вида «abcd-efgh»
                  </Text>
                </Box>
              )}

              <Button type="submit" size="3" disabled={isLoading} style={{ width: '100%' }}>
                {isLoading ? 'Проверяем…' : 'Войти'}
              </Button>
            </Flex>
          </form>

          <Text as="p" size="1" color="gray" mt="5" align="center">
            Забыли пароль или потеряли телефон — обратитесь к администратору профкома
          </Text>
        </div>
      </div>
    </>
  );
}
