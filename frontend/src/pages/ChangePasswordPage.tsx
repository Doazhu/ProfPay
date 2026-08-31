import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircledIcon, InfoCircledIcon, LockClosedIcon } from '@radix-ui/react-icons';
import {
  Box, Button, Callout, Card, Flex, Heading, Text, TextField,
} from '@radix-ui/themes';

import { authApi, extractErrorMessage } from '../services/api';
import PasswordField from '../components/PasswordField';
import TwoFactorSettings from '../components/TwoFactorSettings';

const MIN_LENGTH = 8;

export default function ChangePasswordPage() {
  const navigate = useNavigate();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const [totpEnabled, setTotpEnabled] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Поле кода показываем, только если второй фактор действительно включён.
  useEffect(() => {
    authApi.totpStatus()
      .then((status) => setTotpEnabled(status.enabled))
      .catch(() => setTotpEnabled(false));
  }, []);

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && next !== confirm;
  const sameAsCurrent = next.length > 0 && next === current;

  const canSubmit =
    current.length > 0
    && next.length >= MIN_LENGTH
    && next === confirm
    && !sameAsCurrent
    && (!totpEnabled || totpCode.replace(/\D/g, '').length >= 6)
    && !isSaving;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      await authApi.changePassword(current, next, totpEnabled ? totpCode : undefined);
      setDone(true);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось изменить пароль'));
    } finally {
      setIsSaving(false);
    }
  };

  if (done) {
    return (
      <Box className="animate-fade-in" style={{ maxWidth: 560 }}>
        <Card size="3">
          <Flex direction="column" gap="3" align="start">
            <Callout.Root color="green" style={{ width: '100%' }}>
              <Callout.Icon><CheckCircledIcon /></Callout.Icon>
              <Callout.Text>
                Пароль изменён. Следующий вход — уже с новым.
              </Callout.Text>
            </Callout.Root>
            <Button onClick={() => navigate('/')}>На главную</Button>
          </Flex>
        </Card>
      </Box>
    );
  }

  return (
    <Box className="animate-fade-in" style={{ maxWidth: 560 }}>
      <Flex align="center" gap="2" mb="1">
        <LockClosedIcon width="18" height="18" />
        <Heading size="6">Пароль и вход</Heading>
      </Flex>
      <Text as="p" size="2" color="gray" mb="4">
        Смена пароля и второй фактор — настройки вашей учётной записи
      </Text>

      <TwoFactorSettings />

      <Heading size="4" mb="3">Смена пароля</Heading>

      <Card size="3">
        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="4">
            {error && (
              <Callout.Root color="red">
                <Callout.Text>{error}</Callout.Text>
              </Callout.Root>
            )}

            <Box>
              <Text as="label" htmlFor="current" size="1" weight="medium" color="gray"
                    mb="1" style={{ display: 'block' }}>
                Текущий пароль
              </Text>
              <PasswordField
                id="current"
                value={current}
                onChange={setCurrent}
                placeholder="Введите текущий пароль"
                autoComplete="current-password"
                autoFocus
                required
              />
            </Box>

            <Box>
              <Text as="label" htmlFor="next" size="1" weight="medium" color="gray"
                    mb="1" style={{ display: 'block' }}>
                Новый пароль
              </Text>
              <PasswordField
                id="next"
                value={next}
                onChange={setNext}
                placeholder={`Минимум ${MIN_LENGTH} символов`}
                autoComplete="new-password"
                required
                invalid={tooShort || sameAsCurrent}
              />
              {tooShort && (
                <Text as="p" size="1" color="red" mt="1">
                  Минимум {MIN_LENGTH} символов
                </Text>
              )}
              {sameAsCurrent && (
                <Text as="p" size="1" color="red" mt="1">
                  Новый пароль совпадает с текущим
                </Text>
              )}
            </Box>

            <Box>
              <Text as="label" htmlFor="confirm" size="1" weight="medium" color="gray"
                    mb="1" style={{ display: 'block' }}>
                Подтверждение нового пароля
              </Text>
              <PasswordField
                id="confirm"
                value={confirm}
                onChange={setConfirm}
                placeholder="Повторите новый пароль"
                autoComplete="new-password"
                required
                invalid={mismatch}
              />
              {mismatch && (
                <Text as="p" size="1" color="red" mt="1">Пароли не совпадают</Text>
              )}
            </Box>

            {totpEnabled && (
              <Box>
                <Text as="label" htmlFor="code" size="1" weight="medium" color="gray"
                      mb="1" style={{ display: 'block' }}>
                  Код из приложения
                </Text>
                <TextField.Root
                  id="code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={20}
                  style={{ maxWidth: 180, letterSpacing: '0.15em' }}
                />
                <Text as="p" size="1" color="gray" mt="1">
                  Шестизначный код или резервный вида «abcd-efgh»
                </Text>
              </Box>
            )}

            <Flex gap="3" align="center">
              <Button type="submit" disabled={!canSubmit}>
                {isSaving ? 'Сохраняем…' : 'Сменить пароль'}
              </Button>
              <Button type="button" variant="ghost" color="gray" onClick={() => navigate(-1)}>
                Отмена
              </Button>
            </Flex>
          </Flex>
        </form>
      </Card>

      {/* Пояснение через Callout, а не собственный жёлтый блок: тот был задан
          фиксированными цветами и на тёмной теме светился белым прямоугольником. */}
      <Callout.Root mt="4" color="gray" variant="surface">
        <Callout.Icon><InfoCircledIcon /></Callout.Icon>
        <Callout.Text>
          {totpEnabled
            ? 'Смена пароля подтверждается кодом из приложения — иначе чужая '
              + 'открытая сессия позволила бы сменить пароль в обход второго фактора.'
            : 'После смены пароля вход возможен только с новым паролем. '
              + 'Данные плательщиков это не затрагивает: они зашифрованы отдельным '
              + 'ключом сервера, а не вашим паролем.'}
        </Callout.Text>
      </Callout.Root>
    </Box>
  );
}
