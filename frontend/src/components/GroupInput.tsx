import { useEffect, useMemo, useRef } from 'react';
import { Badge, Box, Flex, Select, Text, TextField } from '@radix-ui/themes';
import type { EducationLevel } from '../types';
import { EDUCATION_LEVELS } from '../types';

/** Год начала текущего учебного года: 2025 для 2025/2026. */
export function currentAcademicYearStart(): number {
  const now = new Date();
  return now.getMonth() + 1 >= 9 ? now.getFullYear() : now.getFullYear() - 1;
}

/** Сколько курсов длится обучение на этом уровне. */
export function durationForLevel(level: EducationLevel): number {
  return EDUCATION_LEVELS.find((l) => l.value === level)?.years ?? 4;
}

/** Курс на сегодня → год поступления. Хранится именно год. */
export function admissionYearFromCourse(course: number): number {
  return currentAcademicYearStart() - (course - 1);
}

/** Год поступления → курс на сегодня. */
export function courseFromAdmissionYear(year: number): number {
  return currentAcademicYearStart() - year + 1;
}

/** «2026/27» — короткая подпись учебного года. */
export function formatAcademicYear(startYear: number): string {
  return `${startYear}/${String(startYear + 1).slice(2)}`;
}

export interface GroupValue {
  course: number;
  letters: string;
  number: string;
  admissionYear: number;
  level: EducationLevel;
}

/** Собрать код группы из частей: 1 + «мд» + «35» → «1-мд-35». */
export function buildGroupName(value: Pick<GroupValue, 'course' | 'letters' | 'number'>): string {
  const parts = [String(value.course), value.letters.trim(), value.number.trim()].filter(Boolean);
  return parts.length >= 2 ? parts.join('-') : '';
}

/** Разобрать «1-мд-35» обратно на части — нужно при открытии карточки. */
export function parseGroupName(groupName: string | null | undefined): {
  course: number | null; letters: string; number: string;
} {
  const empty = { course: null, letters: '', number: '' };
  if (!groupName) return empty;

  const match = groupName.trim().match(/^(\d)\s*-\s*([^-]*?)\s*-\s*(.*)$/);
  if (match) {
    return { course: Number(match[1]), letters: match[2], number: match[3] };
  }
  // Код без ведущего курса — кладём целиком в буквы, чтобы ничего не потерять.
  return { ...empty, letters: groupName.trim() };
}

/** Ширина поля по содержимому, но не меньше нескольких символов. */
function adaptiveWidth(value: string, min: number, max: number): string {
  const chars = Math.min(max, Math.max(min, value.length));
  return `calc(${chars}ch + var(--space-5))`;
}

interface GroupInputProps {
  value: GroupValue;
  onChange: (next: GroupValue) => void;
  /** Год поступления менялся руками — перестаём пересчитывать его по курсу. */
  yearTouched: boolean;
  onYearTouchedChange: (touched: boolean) => void;
  disabled?: boolean;
}

/**
 * Ввод группы: курс, буквы и номер — отдельными полями.
 *
 * Раньше группа была одной строкой «1-мд-35», и из неё выуживался курс.
 * Так проще ошибиться и невозможно проверить формат. Теперь части вводятся
 * раздельно, а код собирается сам.
 *
 * Год поступления не спрашивается: он вычисляется из курса и текущей даты
 * и показывается тут же. Если человек поступил не в тот год (перевёлся,
 * академ, восстановился) — год можно поменять, и тогда пересчёт по курсу
 * прекращается, чтобы не затирать ручной ввод.
 */
export default function GroupInput({
  value, onChange, yearTouched, onYearTouchedChange, disabled,
}: GroupInputProps) {
  const maxCourse = durationForLevel(value.level);
  const base = currentAcademicYearStart();
  const lettersRef = useRef<HTMLInputElement>(null);

  // Пока год не трогали руками — держим его согласованным с курсом.
  useEffect(() => {
    if (yearTouched) return;
    const expected = admissionYearFromCourse(value.course);
    if (expected !== value.admissionYear) {
      onChange({ ...value, admissionYear: expected });
    }
  }, [value.course, yearTouched]); // eslint-disable-line react-hooks/exhaustive-deps

  // Смена уровня может сделать текущий курс невозможным: у магистратуры
  // всего два курса, и «4» после переключения превратится в «2».
  useEffect(() => {
    if (value.course > maxCourse) {
      onChange({ ...value, course: maxCourse });
    }
  }, [maxCourse]); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = buildGroupName(value);

  /**
   * Годы для выбора: восемь назад и четыре вперёд. Вперёд — чтобы можно было
   * завести первокурсника набора 2029/30 заранее, до начала учебного года.
   */
  const yearOptions = useMemo(
    () => Array.from({ length: 13 }, (_, i) => base - 8 + i).reverse(),
    [base],
  );

  const derivedYear = admissionYearFromCourse(value.course);
  const yearMismatch = yearTouched && value.admissionYear !== derivedYear;
  const courseFromYear = courseFromAdmissionYear(value.admissionYear);
  const graduated = courseFromYear > maxCourse;

  return (
    <Flex direction="column" gap="3">
      <Flex gap="4" wrap="wrap" align="end">
        {/* Курс */}
        <Box>
          <Text as="label" size="1" weight="medium" color="gray" mb="1" style={{ display: 'block' }}>
            Курс
          </Text>
          <Select.Root
            value={String(value.course)}
            onValueChange={(next) => onChange({ ...value, course: Number(next) })}
            disabled={disabled}
          >
            <Select.Trigger style={{ width: 68 }} aria-label="Курс" />
            <Select.Content>
              {Array.from({ length: maxCourse }, (_, i) => i + 1).map((course) => (
                <Select.Item key={course} value={String(course)}>{course}</Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Box>

        {/* Буквы и номер группы */}
        <Box>
          <Text as="label" size="1" weight="medium" color="gray" mb="1" style={{ display: 'block' }}>
            Группа
          </Text>
          <Flex align="center" gap="1">
            <TextField.Root
              ref={lettersRef}
              value={value.letters}
              onChange={(e) => onChange({ ...value, letters: e.target.value.trim().toLowerCase() })}
              placeholder="мд"
              maxLength={12}
              disabled={disabled}
              aria-label="Буквы группы"
              style={{ width: adaptiveWidth(value.letters || 'мд', 2, 12), textAlign: 'center' }}
            />
            <Text size="3" color="gray" aria-hidden="true">–</Text>
            <TextField.Root
              value={value.number}
              onChange={(e) => onChange({ ...value, number: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              placeholder="35"
              inputMode="numeric"
              disabled={disabled}
              aria-label="Номер группы"
              style={{ width: adaptiveWidth(value.number || '35', 2, 5), textAlign: 'center' }}
            />
          </Flex>
        </Box>

        {/* Собранный код */}
        <Box pb="1">
          <Text as="div" size="1" color="gray" mb="1">Код группы</Text>
          {preview ? (
            <Badge size="2" variant="soft" style={{ fontFamily: 'var(--code-font-family)' }}>
              {preview}
            </Badge>
          ) : (
            <Text size="2" color="gray">—</Text>
          )}
        </Box>
      </Flex>

      {/* Год поступления */}
      <Flex gap="4" wrap="wrap" align="end">
        <Box>
          <Text as="label" size="1" weight="medium" color="gray" mb="1" style={{ display: 'block' }}>
            Год поступления
          </Text>
          <Select.Root
            value={String(value.admissionYear)}
            onValueChange={(next) => {
              onYearTouchedChange(true);
              onChange({ ...value, admissionYear: Number(next) });
            }}
            disabled={disabled}
          >
            <Select.Trigger style={{ width: 168 }} aria-label="Год поступления" />
            <Select.Content>
              {yearOptions.map((year) => (
                <Select.Item key={year} value={String(year)}>
                  {formatAcademicYear(year)}
                  {year === base ? ' · текущий' : ''}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Box>

        <Box pb="2" style={{ flex: '1 1 260px', minWidth: 240 }}>
          {!yearTouched ? (
            <Text size="1" color="gray">
              Определён по курсу: {value.course} курс сейчас — значит поступление
              в <Text weight="medium">{formatAcademicYear(value.admissionYear)}</Text>.
              Если не так — поменяйте.
            </Text>
          ) : graduated ? (
            <Text size="1" color="amber">
              Срок обучения вышел — запись сразу попадёт в архив выпускников.
            </Text>
          ) : yearMismatch ? (
            <Text size="1" color="gray">
              Задан вручную. По этому году сейчас{' '}
              <Text weight="medium">{courseFromYear} курс</Text>, а не {value.course}.{' '}
              <Text
                role="button"
                tabIndex={0}
                color="green"
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => { onYearTouchedChange(false); onChange({ ...value, admissionYear: derivedYear }); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { onYearTouchedChange(false); onChange({ ...value, admissionYear: derivedYear }); } }}
              >
                Вернуть автоопределение
              </Text>
            </Text>
          ) : (
            <Text size="1" color="gray">Совпадает с автоопределением по курсу.</Text>
          )}
        </Box>
      </Flex>
    </Flex>
  );
}
