import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { GearIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import {
  Badge, Box, Button, Callout, Card, Checkbox, Flex, Grid, Heading, Link,
  Select, Separator, Text, TextArea, TextField,
} from '@radix-ui/themes';

import type {
  DataEntryContext, EducationLevel, Faculty, GroupHint, PayerCreate,
} from '../types';
import { EDUCATION_LEVELS } from '../types';
import {
  dataEntryApi, extractErrorMessage, facultyApi, payerApi, paymentApi,
} from '../services/api';
import GroupInput, {
  admissionYearFromCourse, buildGroupName, courseFromAdmissionYear, formatAcademicYear,
  type GroupValue,
} from '../components/GroupInput';

const money = (amount: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 })
    .format(amount);

/** Подпись поля — Radix не даёт готовой пары «подпись + поле». */
function Field({ label, children, hint }: {
  label: string; children: React.ReactNode; hint?: React.ReactNode;
}) {
  return (
    <Box>
      <Text as="label" size="1" weight="medium" color="gray" mb="1" style={{ display: 'block' }}>
        {label}
      </Text>
      {children}
      {hint && <Box mt="1">{hint}</Box>}
    </Box>
  );
}

export default function AddPayerPage() {
  const navigate = useNavigate();

  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [context, setContext] = useState<DataEntryContext | null>(null);
  const [hints, setHints] = useState<GroupHint[]>([]);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // ФИО и контакты
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Обучение
  const [facultyId, setFacultyId] = useState('');
  const [department, setDepartment] = useState('');
  const [group, setGroup] = useState<GroupValue>({
    course: 1,
    letters: '',
    number: '',
    admissionYear: admissionYearFromCourse(1),
    level: 'bachelor',
  });
  const [yearTouched, setYearTouched] = useState(false);
  const [hintApplied, setHintApplied] = useState<string | null>(null);

  // Бюджетник
  const [isBudget, setIsBudget] = useState(false);
  const [stipend, setStipend] = useState('');
  const [budgetPercent, setBudgetPercent] = useState('1');

  // Платёж вместе с созданием
  const [addPayment, setAddPayment] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [semester, setSemester] = useState<'fall' | 'spring'>(
    new Date().getMonth() + 1 >= 9 ? 'fall' : 'spring',
  );

  useEffect(() => {
    facultyApi.getAll().then(setFaculties).catch(() => setFaculties([]));

    dataEntryApi.getContext()
      .then((data) => {
        setContext(data);
        setBudgetPercent(data.default_budget_percent || '1');
        if (data.default_stipend_amount) setStipend(data.default_stipend_amount);
        // Сумма по умолчанию — взнос за текущий семестр из настроек.
        const forSemester = new Date().getMonth() + 1 >= 9 ? data.fall_amount : data.spring_amount;
        if (forSemester) setPaymentAmount(String(forSemester));
      })
      .catch(() => setContext(null));
  }, []);

  // Подсказки по группам зависят от выбранного деректората.
  useEffect(() => {
    dataEntryApi.getGroupHints(facultyId ? Number(facultyId) : undefined)
      .then(setHints)
      .catch(() => setHints([]));
  }, [facultyId]);

  const groupName = buildGroupName(group);

  /**
   * Ранее заведённая такая же группа.
   *
   * Курс в сравнении не участвует: «1-мд-35» и «3-мд-35» — одна и та же
   * группа на разных курсах, кафедра у них общая.
   */
  const matchedHint = useMemo(() => {
    if (!group.letters || !group.number) return null;
    const suffix = `${group.letters.trim()}-${group.number.trim()}`.toLowerCase();
    return hints.find((hint) => {
      const hintSuffix = hint.group_name.split('-').slice(1).join('-').toLowerCase();
      return hintSuffix === suffix && (!facultyId || hint.faculty_id === Number(facultyId));
    }) ?? null;
  }, [hints, group.letters, group.number, facultyId]);

  // Кафедра и уровень подставляются из найденной группы, но не затирают
  // то, что уже набрали руками.
  useEffect(() => {
    if (!matchedHint || hintApplied === matchedHint.group_name || department.trim()) return;
    if (matchedHint.department) setDepartment(matchedHint.department);
    if (matchedHint.education_level) {
      setGroup((prev) => ({ ...prev, level: matchedHint.education_level }));
    }
    setHintApplied(matchedHint.group_name);
  }, [matchedHint, department, hintApplied]);

  const budgetPayment = useMemo(() => {
    const s = parseFloat(stipend);
    const p = parseFloat(budgetPercent);
    return !isNaN(s) && !isNaN(p) && s > 0 && p > 0 ? Math.round(s * p) / 100 : 0;
  }, [stipend, budgetPercent]);

  const knownDepartments = useMemo(
    () => [...new Set(hints.map((h) => h.department).filter(Boolean))] as string[],
    [hints],
  );

  const canSubmit = Boolean(lastName.trim() && firstName.trim()) && !isSaving;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSaving(true);

    const payload: PayerCreate = {
      last_name: lastName.trim(),
      first_name: firstName.trim(),
      middle_name: middleName.trim() || undefined,
      date_of_birth: birthDate || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      faculty_id: facultyId ? Number(facultyId) : undefined,
      group_name: groupName || undefined,
      department: department.trim() || undefined,
      admission_year: group.admissionYear,
      education_level: group.level,
      is_budget: isBudget,
      stipend_amount: isBudget && stipend ? Number(stipend) : undefined,
      budget_percent: isBudget && budgetPercent ? Number(budgetPercent) : undefined,
      notes: notes.trim() || undefined,
      status: 'unpaid',
    };

    try {
      const payer = await payerApi.create(payload);

      if (addPayment && paymentAmount) {
        try {
          await paymentApi.create({
            payer_id: payer.id,
            amount: Number(paymentAmount),
            payment_date: paymentDate,
            academic_year: context?.academic_year,
            semester,
          });
        } catch (paymentError) {
          // Плательщик уже создан — платёж можно довнести в карточке.
          console.error('Платёж не создан:', paymentError);
        }
      }

      navigate(`/payers/${payer.id}`);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось создать плательщика'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box className="animate-fade-in" style={{ maxWidth: 860 }}>
      <Heading size="6" mb="1">Добавить плательщика</Heading>
      <Text as="p" size="2" color="gray" mb="4">
        Регистрация нового члена профсоюза — СПбГУПТД
      </Text>

      {/*
        Связь с настройками системы. Раньше настройки жили сами по себе,
        и по форме ввода было не понять, что именно из них применяется.
      */}
      {context && (
        <Callout.Root mb="4" variant="surface"
                      color={context.has_payment_settings ? 'gray' : 'amber'}>
          <Callout.Icon>
            {context.has_payment_settings ? <InfoCircledIcon /> : <GearIcon />}
          </Callout.Icon>
          <Callout.Text>
            {context.has_payment_settings ? (
              <>
                Учебный год <Text weight="medium">{context.academic_year}</Text>: взнос{' '}
                {money(Number(context.fall_amount))} за семестр,{' '}
                {money(Number(context.year_total))} за год. Бюджетникам —{' '}
                {context.default_budget_percent}% от стипендии.{' '}
                <Link asChild><RouterLink to="/settings">Изменить в настройках</RouterLink></Link>
              </>
            ) : (
              <>
                Суммы взносов на {context.academic_year} не заданы, поэтому статус
                «частично оплачено» выставляться не будет.{' '}
                <Link asChild><RouterLink to="/settings">Задать суммы</RouterLink></Link>
              </>
            )}
          </Callout.Text>
        </Callout.Root>
      )}

      {error && (
        <Callout.Root color="red" mb="4">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}

      <form onSubmit={handleSubmit}>
        <Flex direction="column" gap="4">

          <Card size="2">
            <Heading size="3" mb="3">Личные данные</Heading>
            <Grid columns={{ initial: '1', sm: '3' }} gap="3">
              <Field label="Фамилия *">
                <TextField.Root value={lastName} onChange={(e) => setLastName(e.target.value)}
                                placeholder="Ренёв" required autoFocus />
              </Field>
              <Field label="Имя *">
                <TextField.Root value={firstName} onChange={(e) => setFirstName(e.target.value)}
                                placeholder="Александр" required />
              </Field>
              <Field label="Отчество">
                <TextField.Root value={middleName} onChange={(e) => setMiddleName(e.target.value)}
                                placeholder="Дмитриевич" />
              </Field>
            </Grid>

            <Grid columns={{ initial: '1', sm: '3' }} gap="3" mt="3">
              <Field label="Дата рождения">
                <TextField.Root type="date" value={birthDate}
                                onChange={(e) => setBirthDate(e.target.value)} />
              </Field>
              <Field label="Email">
                <TextField.Root type="email" value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="me@example.com" />
              </Field>
              <Field label="Телефон">
                <TextField.Root value={phone} onChange={(e) => setPhone(e.target.value)}
                                placeholder="+7 900 123-45-67" />
              </Field>
            </Grid>
          </Card>

          <Card size="2">
            <Heading size="3" mb="1">Обучение</Heading>
            <Text as="p" size="1" color="gray" mb="3">
              Деректорат и уровень образования определяют остальное: сколько курсов
              возможно, когда человек уйдёт в архив и какая кафедра подставится.
            </Text>

            <Grid columns={{ initial: '1', sm: '2' }} gap="3" mb="3">
              <Field
                label="Деректорат"
                hint={context && context.faculties_count === 0 ? (
                  <Text size="1" color="amber">
                    Деректоратов пока нет.{' '}
                    <Link asChild><RouterLink to="/settings">Добавить</RouterLink></Link>
                  </Text>
                ) : undefined}
              >
                <Select.Root value={facultyId || 'none'}
                             onValueChange={(v) => setFacultyId(v === 'none' ? '' : v)}>
                  <Select.Trigger placeholder="Выберите" style={{ width: '100%' }} />
                  <Select.Content>
                    <Select.Item value="none">Не указан</Select.Item>
                    {faculties.map((faculty) => (
                      <Select.Item key={faculty.id} value={String(faculty.id)}>
                        {faculty.short_name ? `${faculty.short_name} — ${faculty.name}` : faculty.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Field>

              <Field label="Уровень образования">
                <Select.Root value={group.level}
                             onValueChange={(v) => setGroup({ ...group, level: v as EducationLevel })}>
                  <Select.Trigger style={{ width: '100%' }} />
                  <Select.Content>
                    {EDUCATION_LEVELS.map((level) => (
                      <Select.Item key={level.value} value={level.value}>
                        {level.label} — {level.years} г.
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Field>
            </Grid>

            <Separator size="4" my="3" />

            <GroupInput
              value={group}
              onChange={setGroup}
              yearTouched={yearTouched}
              onYearTouchedChange={setYearTouched}
            />

            <Box mt="3" style={{ maxWidth: 340 }}>
              <Field
                label="Кафедра"
                hint={matchedHint?.department ? (
                  <Text size="1" color="gray">
                    Подставлена из группы{' '}
                    <Badge variant="soft" size="1">{matchedHint.group_name}</Badge>
                    {' '}— в ней уже {matchedHint.count} чел.
                  </Text>
                ) : undefined}
              >
                <TextField.Root value={department} onChange={(e) => setDepartment(e.target.value)}
                                placeholder="ЦИАТ" list="known-departments" />
                <datalist id="known-departments">
                  {knownDepartments.map((dep) => <option key={dep} value={dep} />)}
                </datalist>
              </Field>
            </Box>
          </Card>

          <Card size="2">
            <Flex align="center" gap="2" mb={isBudget ? '3' : '0'}>
              <Checkbox id="budget" checked={isBudget}
                        onCheckedChange={(v) => setIsBudget(v === true)} />
              <Text as="label" size="2" htmlFor="budget">
                Бюджетник — взнос считается от стипендии
              </Text>
            </Flex>

            {isBudget && (
              <Grid columns={{ initial: '1', sm: '3' }} gap="3">
                <Field label="Стипендия, ₽">
                  <TextField.Root value={stipend} onChange={(e) => setStipend(e.target.value)}
                                  inputMode="decimal" placeholder="2500" />
                </Field>
                <Field label="Процент">
                  <TextField.Root value={budgetPercent} onChange={(e) => setBudgetPercent(e.target.value)}
                                  inputMode="decimal" placeholder="1" />
                </Field>
                <Box>
                  <Text as="div" size="1" weight="medium" color="gray" mb="1">К оплате</Text>
                  <Text as="div" size="5" weight="bold">
                    {budgetPayment > 0 ? money(budgetPayment) : '—'}
                  </Text>
                </Box>
              </Grid>
            )}
          </Card>

          <Card size="2">
            <Flex align="center" gap="2" mb={addPayment ? '3' : '0'}>
              <Checkbox id="pay" checked={addPayment}
                        onCheckedChange={(v) => setAddPayment(v === true)} />
              <Text as="label" size="2" htmlFor="pay">Сразу внести платёж</Text>
            </Flex>

            {addPayment && (
              <Grid columns={{ initial: '1', sm: '3' }} gap="3">
                <Field label="Сумма, ₽">
                  <TextField.Root value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                                  inputMode="decimal" placeholder="120" />
                </Field>
                <Field label="Дата">
                  <TextField.Root type="date" value={paymentDate}
                                  onChange={(e) => setPaymentDate(e.target.value)} />
                </Field>
                <Field label="Семестр">
                  <Select.Root value={semester}
                               onValueChange={(v) => setSemester(v as 'fall' | 'spring')}>
                    <Select.Trigger style={{ width: '100%' }} />
                    <Select.Content>
                      <Select.Item value="fall">Осенний</Select.Item>
                      <Select.Item value="spring">Весенний</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Field>
              </Grid>
            )}
          </Card>

          <Card size="2">
            <Field label="Примечание">
              <TextArea value={notes} onChange={(e) => setNotes(e.target.value)}
                        placeholder="Необязательно" rows={2} />
            </Field>
          </Card>

          <Flex gap="3" justify="end" align="center" wrap="wrap">
            {groupName && (
              <Text size="1" color="gray" style={{ marginRight: 'auto' }}>
                Запишем: <Text weight="medium">{groupName}</Text>, поступление{' '}
                {formatAcademicYear(group.admissionYear)}, сейчас{' '}
                {courseFromAdmissionYear(group.admissionYear)} курс
              </Text>
            )}
            <Button type="button" variant="soft" color="gray" onClick={() => navigate('/payers')}>
              Отмена
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSaving ? 'Сохраняем…' : 'Добавить'}
            </Button>
          </Flex>
        </Flex>
      </form>
    </Box>
  );
}
