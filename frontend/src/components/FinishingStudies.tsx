import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  ArchiveIcon, ArrowRightIcon, CheckCircledIcon, RocketIcon,
} from '@radix-ui/react-icons';
import {
  AlertDialog, Badge, Box, Button, Callout, Dialog, Flex, Heading, Link, Select,
  Text, TextField,
} from '@radix-ui/themes';

import type { EducationLevel, Payer } from '../types';
import { payerApi, extractErrorMessage } from '../services/api';
import {
  currentAcademicYearStart, formatAcademicYear,
} from './GroupInput';

const LEVEL_LABELS: Record<EducationLevel, string> = {
  bachelor: 'Бакалавриат',
  specialist: 'Специалитет',
  master: 'Магистратура',
};

/** Срок обучения словами: «5 лет», а не «5 года». */
const LEVEL_YEARS: Record<EducationLevel, string> = {
  bachelor: '4 года',
  specialist: '5 лет',
  master: '2 года',
};

/**
 * Кто заканчивает обучение этим летом.
 *
 * 1 сентября такие записи уходят в архив сами — курс считается из года
 * поступления. Проблема в том, что уходят они молча: человек, поступивший
 * в магистратуру, пропал бы из списков, и заметили бы это, когда он пришёл
 * платить взнос. Поэтому спрашиваем заранее, и по каждому есть ровно два
 * ответа: продолжил учёбу или ушёл.
 */
interface FinishingStudiesProps {
  /** Сообщить наружу, что список изменился: на главной от него зависит счётчик. */
  onChange?: () => void;
}

export default function FinishingStudies({ onChange }: FinishingStudiesProps = {}) {
  const [payers, setPayers] = useState<Payer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Продолжает учёбу
  const [continuing, setContinuing] = useState<Payer | null>(null);
  const [nextLevel, setNextLevel] = useState<EducationLevel>('master');
  const [nextGroup, setNextGroup] = useState('');
  const [busy, setBusy] = useState(false);

  // Уходит
  const [leaving, setLeaving] = useState<Payer | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setPayers(await payerApi.getFinishing());
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось загрузить список'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 6000);
  };

  /*
    Продолжил учёбу — это не «продление», а новое обучение: другой уровень,
    другой срок и отсчёт курса с нуля. Поэтому год поступления становится
    текущим, и человек снова первокурсник.
  */
  const saveContinued = async () => {
    if (!continuing) return;
    setBusy(true);
    setError('');
    try {
      await payerApi.update(continuing.id, {
        education_level: nextLevel,
        admission_year: currentAcademicYearStart(),
        group_name: nextGroup.trim() || undefined,
      });
      flash(`${continuing.full_name} — теперь ${LEVEL_LABELS[nextLevel].toLowerCase()}, 1 курс`);
      setContinuing(null);
      setNextGroup('');
      await load();
      onChange?.();
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось сохранить'));
    } finally {
      setBusy(false);
    }
  };

  const saveLeft = async () => {
    if (!leaving) return;
    setBusy(true);
    setError('');
    try {
      await payerApi.update(leaving.id, {
        archived_at: new Date().toISOString().slice(0, 10),
      });
      flash(`${leaving.full_name} — в архиве`);
      setLeaving(null);
      await load();
      onChange?.();
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось убрать в архив'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  if (!payers.length) {
    return (
      <Callout.Root color="gray" variant="surface">
        <Callout.Icon><CheckCircledIcon /></Callout.Icon>
        <Callout.Text>Выпускников в этом году нет.</Callout.Text>
      </Callout.Root>
    );
  }

  return (
    <Box>
      <Flex align="center" gap="2" mb="1">
        <RocketIcon />
        <Heading size="4">Скоро закончат обучение</Heading>
        <Badge color="amber">{payers.length}</Badge>
      </Flex>
      <Text as="p" size="2" color="gray" mb="3">
        С 1 сентября уходят в архив.
      </Text>

      {error && (
        <Callout.Root color="red" mb="3"><Callout.Text>{error}</Callout.Text></Callout.Root>
      )}
      {notice && (
        <Callout.Root color="green" mb="3"><Callout.Text>{notice}</Callout.Text></Callout.Root>
      )}

      <Flex direction="column" gap="2">
        {payers.map((payer) => (
          <Flex
            key={payer.id}
            align="center" justify="between" gap="3" wrap="wrap"
            p="3"
            style={{
              border: '1px solid var(--gray-a5)',
              borderRadius: 'var(--radius-3)',
            }}
          >
            <Box style={{ minWidth: 0 }}>
              <Link asChild>
                <RouterLink to={`/payers/${payer.id}`}>
                  <Text weight="medium">{payer.full_name}</Text>
                </RouterLink>
              </Link>
              <Text as="div" size="1" color="gray">
                {payer.group_code || '—'} · {LEVEL_LABELS[payer.education_level]} ·{' '}
                {payer.course} курс
              </Text>
            </Box>

            <Flex gap="2" wrap="wrap">
              <Button
                size="1" variant="soft"
                onClick={() => {
                  setContinuing(payer);
                  // После бакалавриата и специалитета идут в магистратуру,
                  // после магистратуры — обычно снова в неё же. Выбор всё
                  // равно за человеком, это только подстановка.
                  setNextLevel('master');
                  setNextGroup('');
                }}
              >
                <ArrowRightIcon /> Продолжил учёбу
              </Button>
              <Button size="1" variant="soft" color="gray" onClick={() => setLeaving(payer)}>
                <ArchiveIcon /> Закончил или отчислен
              </Button>
            </Flex>
          </Flex>
        ))}
      </Flex>

      {/* ---------- Продолжил учёбу ---------- */}
      <Dialog.Root open={continuing !== null} onOpenChange={(open) => !open && setContinuing(null)}>
        <Dialog.Content maxWidth="460px">
          <Dialog.Title>Продолжил учёбу</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="4">
            {continuing?.full_name} · год поступления{' '}
            {formatAcademicYear(currentAcademicYearStart())}, курс первый.
          </Dialog.Description>

          <Flex direction="column" gap="3">
            <Box>
              <Text as="label" size="1" weight="medium" color="gray" mb="1"
                    style={{ display: 'block' }}>
                Уровень
              </Text>
              <Select.Root value={nextLevel}
                           onValueChange={(value) => setNextLevel(value as EducationLevel)}>
                <Select.Trigger style={{ width: '100%' }} />
                <Select.Content>
                  {(Object.keys(LEVEL_LABELS) as EducationLevel[]).map((level) => (
                    <Select.Item key={level} value={level}>
                      {LEVEL_LABELS[level]} — {LEVEL_YEARS[level]}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Box>

            <Box>
              <Text as="label" size="1" weight="medium" color="gray" mb="1"
                    style={{ display: 'block' }}>
                Новая группа
              </Text>
              <TextField.Root
                value={nextGroup}
                onChange={(e) => setNextGroup(e.target.value.toLowerCase())}
                placeholder="1-мг-2"
              />
              <Text as="p" size="1" color="gray" mt="1">
                Прежняя: {continuing?.group_code || '—'}
              </Text>
            </Box>
          </Flex>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close><Button variant="soft" color="gray">Отмена</Button></Dialog.Close>
            <Button onClick={saveContinued} disabled={busy}>Сохранить</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* ---------- Ушёл ---------- */}
      <AlertDialog.Root open={leaving !== null} onOpenChange={(open) => !open && setLeaving(null)}>
        <AlertDialog.Content maxWidth="440px">
          <AlertDialog.Title>Убрать в архив?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            {leaving?.full_name} уйдёт в «Архив выпускников». Обратимо.
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">Отмена</Button>
            </AlertDialog.Cancel>
            <Button onClick={saveLeft} disabled={busy}>В архив</Button>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Box>
  );
}
