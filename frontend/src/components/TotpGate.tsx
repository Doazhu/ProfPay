import { ReactNode, useEffect, useState } from 'react';
import { ExitIcon, LockClosedIcon } from '@radix-ui/react-icons';
import {
  Box, Button, Callout, Flex, Heading, Text,
} from '@radix-ui/themes';

import type { TotpStatus } from '../types';
import { authApi, extractErrorMessage } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { ThemeToggleButton } from './ThemeToggle';
import LoginBackground from './LoginBackground';
import TwoFactorSettings from './TwoFactorSettings';

/**
 * Обязательная привязка приложения-аутентификатора.
 *
 * Пока в настройках стоит «второй фактор обязателен для всех», человек без
 * привязанного приложения не попадает в рабочие разделы: вместо них
 * открывается эта страница. То же самое проверяет сервер, поэтому обойти
 * экран прямым запросом к API не получится — здесь только объяснение и
 * удобный путь настроить.
 *
 * Заводится второй фактор у каждого своим: секрет, QR и резервные коды
 * принадлежат конкретной учётной записи.
 */
export default function TotpGate({ children }: { children: ReactNode }) {
  const { logout, user } = useAuth();
  const { resolvedAppearance } = useTheme();
  const [status, setStatus] = useState<TotpStatus | null>(null);
  const [failed, setFailed] = useState(false);
  // На экране висят только что выданные резервные коды. Пока человек их
  // не подтвердил, в приложение не уходим — второй раз коды не покажут.
  const [codesPending, setCodesPending] = useState(false);
  const [policyError, setPolicyError] = useState('');
  const [droppingPolicy, setDroppingPolicy] = useState(false);

  useEffect(() => {
    authApi.totpStatus().then(setStatus).catch(() => setFailed(true));
  }, []);

  /*
    Пока состояние неизвестно — ожидание.

    Показывать разделы «на всякий случай» нельзя: их запросы всё равно
    упрутся в 403, а человек успеет увидеть мигнувшую пустую страницу.
    Ожидание тут разовое: компонент монтируется один раз на сессию и
    переходы между разделами его не трогают.
  */
  if (!status && !failed) {
    return <div className="spinner-container"><div className="spinner w-8 h-8" /></div>;
  }

  if (failed || !status || (status.enabled && !codesPending) || !status.required) {
    return <>{children}</>;
  }

  /*
    Снять требование может только администратор и только отсюда: страница
    настроек ему сейчас недоступна — она сама закрыта этим же требованием.
    Иначе администратор без телефона под рукой оказался бы заперт.
  */
  const dropRequirement = async () => {
    setPolicyError('');
    setDroppingPolicy(true);
    try {
      await authApi.setTotpPolicy(false);
      setStatus({ ...status, required: false });
    } catch (err) {
      setPolicyError(extractErrorMessage(err, 'Не удалось изменить настройку'));
    } finally {
      setDroppingPolicy(false);
    }
  };

  /*
    Фон здесь тот же, что на входе, и по той же причине: человек ещё не внутри
    системы — он на пороге. В рабочих разделах такой фон только мешал бы
    читать таблицы, поэтому дальше его нет.
  */
  return (
    <>
      <LoginBackground appearance={resolvedAppearance} />

      <Box style={{ position: 'fixed', top: 16, right: 16, zIndex: 2 }}>
        <ThemeToggleButton />
      </Box>

      <div className="login-shell login-shell--tall">
        <div className="login-glass login-glass--wide animate-fade-in">
          <Flex align="center" gap="2" mb="1">
            <LockClosedIcon width="18" height="18" />
            <Heading size="6">
              {codesPending ? 'Почти всё' : 'Настройте вход по коду'}
            </Heading>
          </Flex>
          <Text as="p" size="2" color="gray" mb="4">
            {codesPending
              ? 'Приложение привязано. Остался один шаг — сохранить резервные '
                + 'коды: они понадобятся, если телефон окажется недоступен.'
              : `${user?.full_name ? `${user.full_name}, вход` : 'Вход'} в ProfPay `
                + 'защищён вторым фактором для всех учётных записей. Привяжите '
                + 'приложение — дальше оно будет спрашивать шестизначный код '
                + 'при каждом входе.'}
          </Text>

          {policyError && (
            <Callout.Root color="red" mb="3">
              <Callout.Text>{policyError}</Callout.Text>
            </Callout.Root>
          )}

          <TwoFactorSettings
            flush
            onStatusChange={setStatus}
            onPendingCodesChange={setCodesPending}
          />

          <Flex gap="3" align="center" wrap="wrap">
            {/* Пока коды не сохранены, уходить с экрана нечем: выход отсюда
                означал бы потерю кодов навсегда. */}
            <Button variant="soft" color="gray" onClick={logout} disabled={codesPending}>
              <ExitIcon />
              Выйти
            </Button>
            {user?.role === 'admin' && (
              <Button
                variant="ghost"
                color="gray"
                onClick={dropRequirement}
                disabled={droppingPolicy || codesPending}
              >
                Не требовать второй фактор от всех
              </Button>
            )}
          </Flex>

          {user?.role === 'admin' && (
            <Text as="p" size="1" color="gray" mt="3">
              Снятое требование можно вернуть в «Настройках». Без него учётные
              записи защищены только паролем.
            </Text>
          )}
        </div>
      </div>
    </>
  );
}
