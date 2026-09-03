import { useEffect, useState } from 'react';
import {
  CheckCircledIcon, ExclamationTriangleIcon, LockClosedIcon, LockOpen1Icon,
  PersonIcon, PlusIcon, TrashIcon,
} from '@radix-ui/react-icons';
import {
  AlertDialog, Badge, Box, Button, Callout, Card, Dialog, Flex, Heading,
  IconButton, Select, Separator, Table, Text, TextField, Tooltip,
} from '@radix-ui/themes';

import type { User, UserRole } from '../types';
import { authApi, userApi, extractErrorMessage } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PasswordField from '../components/PasswordField';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Администратор',
  operator: 'Оператор',
  viewer: 'Просмотр',
};

const ROLE_COLORS: Record<UserRole, 'grass' | 'blue' | 'gray'> = {
  admin: 'grass',
  operator: 'blue',
  viewer: 'gray',
};

const ROLE_HINTS: Record<UserRole, string> = {
  admin: 'всё, включая пользователей и настройки',
  operator: 'ведёт плательщиков и платежи',
  viewer: 'только смотрит, ничего не меняет',
};

const MIN_PASSWORD = 8;

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('ru-RU') : '—';
}

export default function UsersPage() {
  const { isAdmin, user: currentUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Обязателен ли второй фактор всем — от этого зависит, считать ли
  // непривязанное приложение проблемой или личным делом пользователя.
  const [totpRequired, setTotpRequired] = useState(false);

  // Создание
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({
    username: '', email: '', password: '', full_name: '', role: 'viewer' as UserRole,
  });

  // Изменение
  const [editing, setEditing] = useState<User | null>(null);
  const [editDraft, setEditDraft] = useState({
    email: '', full_name: '', role: 'viewer' as UserRole,
  });

  // Пароль
  const [passwordFor, setPasswordFor] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Подтверждения
  const [deleting, setDeleting] = useState<User | null>(null);
  const [resettingTotp, setResettingTotp] = useState<User | null>(null);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
    authApi.totpPolicy().then(setTotpRequired).catch(() => setTotpRequired(false));
  }, []);

  const load = async () => {
    setIsLoading(true);
    try {
      setUsers(await userApi.getAll());
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось загрузить список'));
    } finally {
      setIsLoading(false);
    }
  };

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 6000);
  };

  /**
   * Общая обвязка для действий.
   *
   * Сообщение с сервера показывается пользователю, а не уходит в консоль:
   * «это последний администратор» или «логин занят» бухгалтеру важнее общей
   * фразы «ошибка».
   */
  const run = async (action: () => Promise<void>, fallback: string) => {
    setError('');
    setBusy(true);
    try {
      await action();
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const createUser = () =>
    run(async () => {
      await userApi.create(draft);
      setCreateOpen(false);
      flash(
        totpRequired
          ? `Пользователь «${draft.username}» создан. При первом входе он `
            + 'привяжет своё приложение-аутентификатор.'
          : `Пользователь «${draft.username}» создан`,
      );
      setDraft({ username: '', email: '', password: '', full_name: '', role: 'viewer' });
    }, 'Не удалось создать пользователя');

  const saveUser = () =>
    run(async () => {
      if (!editing) return;
      await userApi.update(editing.id, {
        email: editDraft.email.trim(),
        full_name: editDraft.full_name.trim(),
        role: editDraft.role,
      });
      setEditing(null);
    }, 'Не удалось сохранить');

  const setPassword = () =>
    run(async () => {
      if (!passwordFor) return;
      await userApi.setPassword(passwordFor.id, newPassword);
      flash(`Пароль для «${passwordFor.username}» изменён. Второй фактор не затронут.`);
      setPasswordFor(null);
      setNewPassword('');
    }, 'Не удалось изменить пароль');

  const toggleActive = (user: User) =>
    run(async () => { await userApi.update(user.id, { is_active: !user.is_active }); },
        'Не удалось изменить состояние');

  const unlock = (user: User) =>
    run(async () => {
      await userApi.unlock(user.id);
      flash(`Блокировка входа для «${user.username}» снята`);
    }, 'Не удалось снять блокировку');

  const resetTotp = () =>
    run(async () => {
      if (!resettingTotp) return;
      await userApi.resetTotp(resettingTotp.id);
      flash(`Второй фактор для «${resettingTotp.username}» сброшен`);
      setResettingTotp(null);
    }, 'Не удалось сбросить второй фактор');

  const removeUser = () =>
    run(async () => {
      if (!deleting) return;
      await userApi.delete(deleting.id);
      flash(`Пользователь «${deleting.username}» удалён`);
      setDeleting(null);
    }, 'Не удалось удалить пользователя');

  if (!isAdmin) {
    return (
      <Callout.Root color="red">
        <Callout.Icon><LockClosedIcon /></Callout.Icon>
        <Callout.Text>Раздел доступен только администраторам.</Callout.Text>
      </Callout.Root>
    );
  }

  if (isLoading) {
    return <div className="spinner-container"><div className="spinner w-8 h-8" /></div>;
  }

  const canCreate =
    draft.username.trim().length >= 3
    && draft.email.trim().length > 0
    && draft.full_name.trim().length >= 2
    && draft.password.length >= MIN_PASSWORD;

  const withoutTotp = users.filter((user) => !user.totp_enabled).length;

  return (
    <Box className="animate-fade-in">
      <Flex align="center" justify="between" gap="3" wrap="wrap" mb="4">
        <Box>
          <Heading size="6">Пользователи</Heading>
          <Text as="p" size="2" color="gray">
            Учётные записи, роли и второй фактор
          </Text>
        </Box>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon /> Добавить
        </Button>
      </Flex>

      {error && (
        <Callout.Root color="red" mb="4">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}

      {notice && (
        <Callout.Root color="green" mb="4">
          <Callout.Icon><CheckCircledIcon /></Callout.Icon>
          <Callout.Text>{notice}</Callout.Text>
        </Callout.Root>
      )}

      {/* Сразу видно, у кого вход ещё не защищён кодом */}
      {totpRequired && withoutTotp > 0 && (
        <Callout.Root color="amber" mb="4">
          <Callout.Icon><LockOpen1Icon /></Callout.Icon>
          <Callout.Text>
            Второй фактор не настроен у {withoutTotp} из {users.length}.
            Пока приложение не привязано, разделы для них закрыты — экран
            привязки откроется при следующем входе.
          </Callout.Text>
        </Callout.Root>
      )}

      <Card size="2">
        <Box style={{ overflowX: 'auto' }}>
          <Table.Root variant="ghost" size="2">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Пользователь</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Роль</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Вход</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Последний вход</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">Действия</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>

            <Table.Body>
              {users.map((user) => {
                const isSelf = user.id === currentUser?.id;
                return (
                  <Table.Row key={user.id} align="center">
                    <Table.Cell>
                      <Flex align="center" gap="2" wrap="wrap">
                        <Text weight="medium">{user.full_name}</Text>
                        {isSelf && <Badge variant="soft" color="gray" size="1">вы</Badge>}
                        {!user.is_active && <Badge color="red" size="1">отключён</Badge>}
                      </Flex>
                      <Text as="div" size="1" color="gray">
                        {user.username} · {user.email}
                      </Text>
                    </Table.Cell>

                    <Table.Cell>
                      <Tooltip content={ROLE_HINTS[user.role]}>
                        <Badge color={ROLE_COLORS[user.role]} variant="soft">
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      </Tooltip>
                    </Table.Cell>

                    <Table.Cell>
                      <Flex direction="column" gap="1" align="start">
                        {user.totp_enabled ? (
                          <Badge color="green" variant="soft">
                            <LockClosedIcon /> код из приложения
                          </Badge>
                        ) : (
                          <Badge color={totpRequired ? 'amber' : 'gray'} variant="soft">
                            <LockOpen1Icon /> только пароль
                          </Badge>
                        )}
                        {user.is_locked && (
                          <Badge color="red" variant="soft">вход заблокирован</Badge>
                        )}
                      </Flex>
                    </Table.Cell>

                    <Table.Cell>
                      <Text size="2" color="gray">{formatDate(user.last_login)}</Text>
                    </Table.Cell>

                    <Table.Cell justify="end">
                      <Flex gap="2" justify="end" wrap="wrap">
                        <Button
                          size="1" variant="soft" color="gray"
                          onClick={() => {
                            setEditing(user);
                            setEditDraft({
                              email: user.email,
                              full_name: user.full_name,
                              role: user.role,
                            });
                          }}
                        >
                          Изменить
                        </Button>

                        <Button size="1" variant="soft" color="gray"
                                onClick={() => { setPasswordFor(user); setNewPassword(''); }}>
                          Пароль
                        </Button>

                        {user.totp_enabled && (
                          <Tooltip content="Когда телефон потерян, а резервных кодов не осталось">
                            <Button size="1" variant="soft" color="gray"
                                    onClick={() => setResettingTotp(user)}>
                              Сбросить 2FA
                            </Button>
                          </Tooltip>
                        )}

                        {user.is_locked && (
                          <Button size="1" variant="soft"
                                  onClick={() => unlock(user)} disabled={busy}>
                            Разблокировать
                          </Button>
                        )}

                        {!isSelf && (
                          <>
                            <Button size="1" variant="soft"
                                    color={user.is_active ? 'amber' : 'green'}
                                    onClick={() => toggleActive(user)} disabled={busy}>
                              {user.is_active ? 'Отключить' : 'Включить'}
                            </Button>
                            <Tooltip content="Удалить учётную запись">
                              <IconButton size="1" variant="soft" color="red"
                                          onClick={() => setDeleting(user)}>
                                <TrashIcon />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Box>
      </Card>

      <Callout.Root mt="4" color="gray" variant="surface">
        <Callout.Icon><PersonIcon /></Callout.Icon>
        <Callout.Text>
          Отключённая запись в систему не входит, но её данные сохраняются;
          удаление необратимо. После 5 неудачных попыток вход блокируется
          на 15 минут — снять блокировку раньше можно кнопкой «Разблокировать».
          Забытый пароль задаёт здесь администратор: восстановления по почте нет.
        </Callout.Text>
      </Callout.Root>

      {/* ---------- Новый пользователь ---------- */}
      <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog.Content maxWidth="480px">
          <Dialog.Title>Новый пользователь</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="4">
            Пароль вы передаёте человеку сами — сменить его он сможет
            в разделе «Пароль и вход».
          </Dialog.Description>

          <Flex direction="column" gap="3">
            <Box>
              <Text as="label" size="1" weight="medium" color="gray" mb="1"
                    style={{ display: 'block' }}>Логин</Text>
              <TextField.Root
                value={draft.username}
                onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                placeholder="ivanova"
                autoComplete="off"
              />
              <Text as="p" size="1" color="gray" mt="1">
                Латиница, цифры, точка, дефис и подчёркивание
              </Text>
            </Box>

            <Box>
              <Text as="label" size="1" weight="medium" color="gray" mb="1"
                    style={{ display: 'block' }}>ФИО</Text>
              <TextField.Root
                value={draft.full_name}
                onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                placeholder="Иванова Мария Сергеевна"
              />
            </Box>

            <Box>
              <Text as="label" size="1" weight="medium" color="gray" mb="1"
                    style={{ display: 'block' }}>Почта</Text>
              <TextField.Root
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder="ivanova@profpay.site"
                autoComplete="off"
              />
              <Text as="p" size="1" color="gray" mt="1">
                По ней тоже можно входить; писем система не шлёт
              </Text>
            </Box>

            <Box>
              <Text as="label" size="1" weight="medium" color="gray" mb="1"
                    style={{ display: 'block' }}>Пароль</Text>
              <PasswordField
                value={draft.password}
                onChange={(value) => setDraft({ ...draft, password: value })}
                placeholder={`Минимум ${MIN_PASSWORD} символов`}
                autoComplete="new-password"
              />
            </Box>

            <Box>
              <Text as="label" size="1" weight="medium" color="gray" mb="1"
                    style={{ display: 'block' }}>Роль</Text>
              <Select.Root
                value={draft.role}
                onValueChange={(value) => setDraft({ ...draft, role: value as UserRole })}
              >
                <Select.Trigger style={{ width: '100%' }} />
                <Select.Content>
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                    <Select.Item key={role} value={role}>
                      {ROLE_LABELS[role]} — {ROLE_HINTS[role]}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Box>
          </Flex>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close><Button variant="soft" color="gray">Отмена</Button></Dialog.Close>
            <Button onClick={createUser} disabled={!canCreate || busy}>Создать</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* ---------- Изменение ---------- */}
      <Dialog.Root open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <Dialog.Content maxWidth="440px">
          <Dialog.Title>Изменить пользователя</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="4">
            {editing?.username}
          </Dialog.Description>

          <Flex direction="column" gap="3">
            <Box>
              <Text as="label" size="1" weight="medium" color="gray" mb="1"
                    style={{ display: 'block' }}>ФИО</Text>
              <TextField.Root
                value={editDraft.full_name}
                onChange={(e) => setEditDraft({ ...editDraft, full_name: e.target.value })}
              />
            </Box>
            <Box>
              <Text as="label" size="1" weight="medium" color="gray" mb="1"
                    style={{ display: 'block' }}>Почта</Text>
              <TextField.Root
                type="email"
                value={editDraft.email}
                onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })}
              />
            </Box>
            <Box>
              <Text as="label" size="1" weight="medium" color="gray" mb="1"
                    style={{ display: 'block' }}>Роль</Text>
              <Select.Root
                value={editDraft.role}
                onValueChange={(value) => setEditDraft({ ...editDraft, role: value as UserRole })}
                disabled={editing?.id === currentUser?.id}
              >
                <Select.Trigger style={{ width: '100%' }} />
                <Select.Content>
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                    <Select.Item key={role} value={role}>{ROLE_LABELS[role]}</Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
              {editing?.id === currentUser?.id && (
                <Text as="p" size="1" color="gray" mt="1">
                  Свою роль изменить нельзя — иначе можно остаться без прав
                </Text>
              )}
            </Box>
          </Flex>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close><Button variant="soft" color="gray">Отмена</Button></Dialog.Close>
            <Button onClick={saveUser} disabled={busy}>Сохранить</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* ---------- Новый пароль ---------- */}
      <Dialog.Root open={passwordFor !== null}
                   onOpenChange={(open) => !open && setPasswordFor(null)}>
        <Dialog.Content maxWidth="420px">
          <Dialog.Title>Новый пароль</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="4">
            Для «{passwordFor?.username}». Заодно снимется блокировка входа,
            если она была. Второй фактор при этом остаётся на месте.
          </Dialog.Description>

          <PasswordField
            value={newPassword}
            onChange={setNewPassword}
            placeholder={`Минимум ${MIN_PASSWORD} символов`}
            autoComplete="new-password"
          />

          <Separator my="4" size="4" />
          <Flex gap="3" justify="end">
            <Dialog.Close><Button variant="soft" color="gray">Отмена</Button></Dialog.Close>
            <Button onClick={setPassword}
                    disabled={newPassword.length < MIN_PASSWORD || busy}>
              Задать пароль
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* ---------- Сброс второго фактора ---------- */}
      <AlertDialog.Root open={resettingTotp !== null}
                        onOpenChange={(open) => !open && setResettingTotp(null)}>
        <AlertDialog.Content maxWidth="440px">
          <AlertDialog.Title>Сбросить второй фактор?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            «{resettingTotp?.username}» сможет войти по одному паролю, пока
            не привяжет приложение заново. Делайте это, только если человек
            действительно потерял и телефон, и резервные коды.
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">Отмена</Button>
            </AlertDialog.Cancel>
            <Button color="red" onClick={resetTotp} disabled={busy}>Сбросить</Button>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>

      {/* ---------- Удаление ---------- */}
      <AlertDialog.Root open={deleting !== null}
                        onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialog.Content maxWidth="440px">
          <AlertDialog.Title>Удалить пользователя?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            «{deleting?.full_name}» будет удалён без возможности вернуть.
            Если нужно просто закрыть доступ — отключите запись, данные
            при этом сохранятся.
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">Отмена</Button>
            </AlertDialog.Cancel>
            <Button color="red" onClick={removeUser} disabled={busy}>Удалить</Button>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Box>
  );
}
