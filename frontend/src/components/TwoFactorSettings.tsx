import { useEffect, useState } from 'react';
import {
  CheckCircledIcon, CopyIcon, DownloadIcon, ExclamationTriangleIcon, LockClosedIcon,
} from '@radix-ui/react-icons';
import {
  Badge, Box, Button, Callout, Card, Code, Dialog, Flex, Heading, Text, TextField,
} from '@radix-ui/themes';

import type { TotpSetup, TotpStatus } from '../types';
import { authApi, extractErrorMessage } from '../services/api';
import PasswordField from './PasswordField';

/**
 * Второй фактор входа через приложение-аутентификатор.
 *
 * Привязка идёт в два шага намеренно: сначала сервер выдаёт секрет и QR,
 * и только после ввода кода фактор включается. Иначе можно было бы включить
 * его, не успев настроить приложение, и запереть себя.
 */
interface TwoFactorSettingsProps {
  /** Сообщить наружу, что состояние изменилось — нужно экрану обязательной привязки. */
  onStatusChange?: (status: TotpStatus) => void;
  /**
   * На экране показаны резервные коды, и человек их ещё не подтвердил.
   *
   * Экран обязательной привязки по этому признаку придерживает переход
   * в приложение: иначе коды исчезали бы в ту же секунду, как фактор
   * включился, — прочитать их было некогда, а второй раз их не покажут.
   */
  onPendingCodesChange?: (pending: boolean) => void;
  /**
   * Убрать собственную рамку.
   *
   * На экране обязательной привязки блок лежит внутри стеклянной панели,
   * и вторая карточка внутри первой смотрится коробкой в коробке.
   */
  flush?: boolean;
}

export default function TwoFactorSettings(
  { onStatusChange, onPendingCodesChange, flush = false }: TwoFactorSettingsProps = {},
) {
  const [status, setStatus] = useState<TotpStatus | null>(null);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  // Имя учётной записи запоминается на шаге привязки: в файл с кодами полезно
  // записать, к чему они, — у человека может быть несколько таких файлов.
  const [account, setAccount] = useState('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Отключение
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  // Перевыпуск резервных кодов
  const [reissueOpen, setReissueOpen] = useState(false);
  const [reissuePassword, setReissuePassword] = useState('');
  const [reissueCode, setReissueCode] = useState('');

  const refresh = () => authApi.totpStatus()
    .then((next) => {
      setStatus(next);
      onStatusChange?.(next);
    })
    .catch(() => setStatus(null));

  useEffect(() => { refresh(); }, []);

  const startSetup = async () => {
    setError('');
    setBusy(true);
    try {
      const next = await authApi.totpSetup();
      setSetup(next);
      setAccount(next.account);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось начать привязку'));
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async () => {
    setError('');
    setBusy(true);
    try {
      const codes = await authApi.totpEnable(code);
      setRecoveryCodes(codes);
      setCopied(false);
      setSaved(false);
      // Сообщается до обновления статуса: иначе экран обязательной привязки
      // успеет увидеть «фактор включён» и уйти вместе с кодами.
      onPendingCodesChange?.(true);
      setSetup(null);
      setCode('');
      await refresh();
    } catch (err) {
      setError(extractErrorMessage(err, 'Код неверен'));
    } finally {
      setBusy(false);
    }
  };

  const codesAsText = (codes: string[], account?: string) =>
    [
      'Резервные коды ProfPay',
      account ? `Учётная запись: ${account}` : '',
      `Выданы: ${new Date().toLocaleString('ru-RU')}`,
      '',
      ...codes,
      '',
      'Каждый код работает один раз и заменяет код из приложения,',
      'если телефон потерян. Храните этот файл не на том же телефоне.',
    ].filter(Boolean).join('\n');

  const copyCodes = async (codes: string[]) => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 4000);
    } catch {
      // Буфер обмена недоступен по HTTP и в части браузеров — коды всё равно
      // видны на экране и скачиваются файлом, так что это не тупик.
      setError('Браузер не дал доступ к буферу. Скачайте файл или перепишите коды.');
    }
  };

  const downloadCodes = (codes: string[]) => {
    const blob = new Blob([codesAsText(codes, account)], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'profpay-резервные-коды.txt';
    link.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  };

  const reissue = async () => {
    setError('');
    setBusy(true);
    try {
      const codes = await authApi.totpReissueRecoveryCodes(reissuePassword, reissueCode);
      setRecoveryCodes(codes);
      setCopied(false);
      setSaved(false);
      onPendingCodesChange?.(true);
      setReissueOpen(false);
      setReissuePassword('');
      setReissueCode('');
      await refresh();
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось выпустить новые коды'));
    } finally {
      setBusy(false);
    }
  };

  const acknowledgeCodes = () => {
    setRecoveryCodes(null);
    onPendingCodesChange?.(false);
  };

  const disable = async () => {
    setError('');
    setBusy(true);
    try {
      await authApi.totpDisable(disablePassword, disableCode);
      setDisableOpen(false);
      setDisablePassword('');
      setDisableCode('');
      await refresh();
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось отключить'));
    } finally {
      setBusy(false);
    }
  };

  /*
    QR отдаётся картинкой через data:-адрес, а не вставкой разметки.
    dangerouslySetInnerHTML для этого не нужен, а Content-Security-Policy
    уже разрешает img-src data: — дыру открывать не пришлось.

    Параметр пишется как charset=utf-8: `;utf8` — не существующая запись,
    браузеры её не обязаны понимать.
  */
  const qrSrc = setup
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(setup.qr_svg)}`
    : null;

  const Shell = flush ? Box : Card;

  return (
    <Shell {...(flush ? { mb: '5' as const } : { size: '2' as const, mb: '5' as const })}>
      <Flex align="center" gap="2" mb="1">
        <LockClosedIcon />
        <Heading size="3">Вход по коду из приложения</Heading>
        {status?.enabled && <Badge color="green">Включён</Badge>}
      </Flex>
      <Text as="p" size="1" color="gray" mb="3">
        Второй фактор: кроме пароля при входе спрашивается шестизначный код
        из Google Authenticator, Aegis или другого подобного приложения.
      </Text>

      {error && (
        <Callout.Root color="red" mb="3">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}

      {/*
        Резервные коды показываются ровно один раз, поэтому блок держится
        на экране, пока человек сам его не закроет. Раньше на экране первой
        привязки он исчезал сразу: фактор включался, и экран уходил
        в приложение вместе с кодами — прочитать их было некогда.
      */}
      {recoveryCodes && (
        <Box mb="4" p="4" style={{
          border: '1px solid var(--amber-7)',
          background: 'var(--amber-2)',
          borderRadius: 'var(--radius-4)',
        }}>
          <Flex align="center" gap="2" mb="1">
            <ExclamationTriangleIcon color="var(--amber-11)" />
            <Heading size="3">Сохраните резервные коды</Heading>
          </Flex>
          <Text as="p" size="2" color="gray" mb="3">
            Второй раз они не покажутся: в базе остаются только их отпечатки.
            Каждый код срабатывает один раз и заменяет код из приложения,
            если телефон потерян или разряжен.
          </Text>

          {/* Моноширинные, в две колонки — так их удобно переписывать с экрана */}
          <Box mb="3" p="3" style={{
            background: 'var(--color-panel-solid)',
            borderRadius: 'var(--radius-3)',
          }}>
            <Flex wrap="wrap" gap="2">
              {recoveryCodes.map((value) => (
                <Code key={value} size="3" variant="ghost"
                      style={{ minWidth: 96, letterSpacing: '0.04em' }}>
                  {value}
                </Code>
              ))}
            </Flex>
          </Box>

          <Flex gap="2" wrap="wrap" mb="3">
            <Button variant="soft" onClick={() => downloadCodes(recoveryCodes)}>
              <DownloadIcon /> Скачать файлом
            </Button>
            <Button variant="soft" color="gray" onClick={() => copyCodes(recoveryCodes)}>
              <CopyIcon /> {copied ? 'Скопировано' : 'Скопировать'}
            </Button>
            <Button variant="soft" color="gray" onClick={() => window.print()}>
              Распечатать
            </Button>
          </Flex>

          <Text as="p" size="1" color="gray" mb="3">
            Держите их не на том же телефоне, где стоит приложение: смысл
            резервных кодов в том, чтобы войти, когда телефона под рукой нет.
          </Text>

          <Button onClick={acknowledgeCodes}>
            {saved ? 'Готово, коды сохранены' : 'Я сохранил коды — продолжить'}
          </Button>
        </Box>
      )}

      {/* Шаг привязки */}
      {setup && (
        <Box mb="3">
          <Flex gap="4" wrap="wrap" align="start">
            {qrSrc && (
              <Box style={{ background: '#fff', padding: 8, borderRadius: 'var(--radius-3)' }}>
                <img src={qrSrc} alt="QR-код для привязки приложения"
                     width={168} height={168} />
              </Box>
            )}
            <Box style={{ flex: '1 1 260px' }}>
              <Text as="p" size="2" mb="2">
                Отсканируйте код в приложении, затем введите шестизначное число,
                которое оно покажет.
              </Text>
              <Text as="p" size="1" color="gray" mb="1">
                Если сканировать нечем, добавьте ключ вручную:
              </Text>
              <Code size="1" style={{ wordBreak: 'break-all' }}>{setup.secret}</Code>

              <Flex gap="2" mt="3" align="center">
                <TextField.Root
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                  style={{ width: 120, letterSpacing: '0.15em' }}
                  aria-label="Код из приложения"
                />
                <Button onClick={confirmSetup} disabled={code.length < 6 || busy}>
                  Включить
                </Button>
                <Button variant="ghost" color="gray"
                        onClick={() => { setSetup(null); setCode(''); }}>
                  Отмена
                </Button>
              </Flex>
            </Box>
          </Flex>
        </Box>
      )}

      {/* Обычное состояние */}
      {!setup && status && (
        status.enabled ? (
          <Flex align="center" gap="3" wrap="wrap">
            <Flex align="center" gap="1">
              <CheckCircledIcon color="var(--green-11)" />
              <Text size="2">
                Резервных кодов осталось: <Text weight="medium">{status.recovery_codes_left}</Text>
              </Text>
            </Flex>
            <Button variant="soft" color="gray" onClick={() => setReissueOpen(true)}>
              Новые резервные коды
            </Button>
            {status.required ? (
              <Text size="1" color="gray">
                Отключить нельзя: второй фактор обязателен для всех
              </Text>
            ) : (
              <Button variant="soft" color="red" onClick={() => setDisableOpen(true)}>
                Отключить
              </Button>
            )}
          </Flex>
        ) : (
          <Button onClick={startSetup} disabled={busy}>
            {busy ? 'Готовим…' : 'Включить'}
          </Button>
        )
      )}

      <Text as="p" size="1" color="gray" mt="3">
        Восстановления пароля по почте нет — почтовый сервер для этого не нужен.
        Если пароль забыт, его задаёт другой администратор в разделе «Пользователи».
      </Text>

      {/* Перевыпуск: старый набор гаснет целиком */}
      <Dialog.Root open={reissueOpen} onOpenChange={setReissueOpen}>
        <Dialog.Content maxWidth="420px">
          <Dialog.Title>Новые резервные коды</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="4">
            Прежние восемь перестанут работать все сразу — иначе новый набор
            не уменьшал бы риск. Подтвердите, что это вы.
          </Dialog.Description>

          <Flex direction="column" gap="3">
            <Box>
              <Text as="label" size="1" weight="medium" color="gray" mb="1"
                    style={{ display: 'block' }}>
                Пароль
              </Text>
              <PasswordField value={reissuePassword} onChange={setReissuePassword}
                             autoComplete="current-password" />
            </Box>
            <Box>
              <Text as="label" size="1" weight="medium" color="gray" mb="1"
                    style={{ display: 'block' }}>
                Код из приложения
              </Text>
              <TextField.Root value={reissueCode} onChange={(e) => setReissueCode(e.target.value)}
                              placeholder="000000" inputMode="numeric" maxLength={20}
                              style={{ width: 140, letterSpacing: '0.15em' }} />
            </Box>
          </Flex>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">Отмена</Button>
            </Dialog.Close>
            <Button onClick={reissue}
                    disabled={!reissuePassword || reissueCode.length < 6 || busy}>
              Выпустить
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Отключение: под пароль и действующий код */}
      <Dialog.Root open={disableOpen} onOpenChange={setDisableOpen}>
        <Dialog.Content maxWidth="420px">
          <Dialog.Title>Отключить второй фактор</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="4">
            Вход снова будет защищён только паролем.
          </Dialog.Description>

          <Flex direction="column" gap="3">
            <Box>
              <Text as="label" size="1" weight="medium" color="gray" mb="1"
                    style={{ display: 'block' }}>
                Пароль
              </Text>
              <PasswordField value={disablePassword} onChange={setDisablePassword}
                             autoComplete="current-password" />
            </Box>
            <Box>
              <Text as="label" size="1" weight="medium" color="gray" mb="1"
                    style={{ display: 'block' }}>
                Код из приложения
              </Text>
              <TextField.Root value={disableCode} onChange={(e) => setDisableCode(e.target.value)}
                              placeholder="000000" inputMode="numeric" maxLength={20}
                              style={{ width: 140, letterSpacing: '0.15em' }} />
            </Box>
          </Flex>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">Отмена</Button>
            </Dialog.Close>
            <Button color="red" onClick={disable}
                    disabled={!disablePassword || disableCode.length < 6 || busy}>
              Отключить
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Shell>
  );
}
