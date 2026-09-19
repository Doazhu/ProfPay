import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  BarChartIcon, ExclamationTriangleIcon, PersonIcon,
} from '@radix-ui/react-icons';
import {
  Badge, Box, Callout, Flex, Grid, Heading, Link, Progress, Separator, Spinner,
  Table, Text,
} from '@radix-ui/themes';

import type { DashboardStats, FacultyStats } from '../types';
import { statsApi } from '../services/api';
import GlowCard from '../components/GlowCard';
import Reveal from '../components/Reveal';
import FinishingStudies from '../components/FinishingStudies';

const money = (amount: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency', currency: 'RUB', minimumFractionDigits: 0,
  }).format(amount);

/** Доля в процентах, округлённая до целого. Ноль от нуля — это ноль, а не NaN. */
function share(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

interface MetricProps {
  label: string;
  value: string | number;
  hint?: string;
  color?: 'gray' | 'green' | 'amber' | 'red';
  to?: string;
}

/** Одно число крупно: без иконок-кружков, которые ничего не сообщают. */
function Metric({ label, value, hint, color = 'gray', to }: MetricProps) {
  const body = (
    <GlowCard>
      <Text as="div" size="2" color="gray">{label}</Text>
      <Heading size="7" mt="1" color={color === 'gray' ? undefined : color}>
        {value}
      </Heading>
      {hint && <Text as="div" size="1" color="gray" mt="1">{hint}</Text>}
    </GlowCard>
  );

  return to ? (
    <Link asChild underline="none" style={{ color: 'inherit' }}>
      <RouterLink to={to}>{body}</RouterLink>
    </Link>
  ) : body;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [facultyStats, setFacultyStats] = useState<FacultyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /*
    Перечитывается и при первой загрузке, и после разбора выпускников: перевод
    в магистратуру или уход в архив меняет и число участников, и счётчик
    «Скоро выпуск». Без этого на одном экране висели бы разные числа.
  */
  const load = useCallback(() => (
    Promise.all([statsApi.getDashboard(), statsApi.getByFaculty()])
      .then(([dashboard, faculties]) => {
        setStats(dashboard);
        setFacultyStats(faculties);
      })
      .catch((error) => console.error('Не удалось загрузить статистику:', error))
      .finally(() => setIsLoading(false))
  ), []);

  useEffect(() => { load(); }, [load]);

  if (isLoading) {
    return (
      <Flex align="center" justify="center" style={{ height: 220 }}>
        <Spinner size="3" />
      </Flex>
    );
  }

  const total = stats?.total_payers ?? 0;
  const budget = stats?.budget_count ?? 0;
  const paying = stats?.paying_count ?? 0;
  const debtors = stats?.total_debtors ?? 0;
  const collected = stats?.total_paid_amount ?? 0;
  const paid = stats?.paid_count ?? 0;

  const withFacultyData = facultyStats.filter((row) => row.total_payers > 0);

  return (
    <Box>
      <Reveal>
        <Box mb="5">
          <Heading size="6">Панель управления</Heading>
          <Text as="p" size="2" color="gray">
            Участники профкома и сбор взносов
          </Text>
        </Box>
      </Reveal>

      {/*
        Участники — главное число, и оно больше остальных не случайно: профком
        считает людей, а не деньги. Разбивка под ним объясняет, с кого взносы
        вообще собираются: у бюджетника их удерживают из стипендии.
      */}
      <Reveal delay={0.05}>
        <GlowCard padding={24}>
          <Flex align="center" gap="2" mb="1">
            <PersonIcon />
            <Text size="2" color="gray">Участники профкома</Text>
          </Flex>
          <Heading size="9">{total}</Heading>

          <Separator my="4" size="4" />

          <Grid columns={{ initial: '1', sm: '2' }} gap="4">
            <Box>
              <Flex align="baseline" justify="between" mb="1">
                <Text size="2">Бюджет</Text>
                <Text size="2" weight="medium">
                  {budget} · {share(budget, total)}%
                </Text>
              </Flex>
              <Progress value={share(budget, total)} color="green" />
              <Text as="p" size="1" color="gray" mt="1">
                Взнос удерживают из стипендии — профком денег не собирает
              </Text>
            </Box>

            <Box>
              <Flex align="baseline" justify="between" mb="1">
                <Text size="2">Платники</Text>
                <Text size="2" weight="medium">
                  {paying} · {share(paying, total)}%
                </Text>
              </Flex>
              <Progress value={share(paying, total)} color="amber" />
              <Text as="p" size="1" color="gray" mt="1">
                Вносят взнос сами — именно по ним считаются долги и сборы
              </Text>
            </Box>
          </Grid>
        </GlowCard>
      </Reveal>

      {/* Деньги и долги — только по платникам */}
      <Grid columns={{ initial: '1', sm: '3' }} gap="4" mt="4">
        <Reveal delay={0.1}>
          <Metric
            label="Собрано с платников"
            value={money(collected)}
            hint={`${paid} из ${paying} внесли взнос`}
            color="green"
          />
        </Reveal>
        <Reveal delay={0.15}>
          <Metric
            label="Должники"
            value={debtors}
            hint={paying > 0 ? `${share(debtors, paying)}% платников` : 'платников нет'}
            color={debtors > 0 ? 'red' : 'gray'}
            to="/debtors"
          />
        </Reveal>
        <Reveal delay={0.2}>
          <Metric
            label="Скоро выпуск"
            value={stats?.finishing_count ?? 0}
            hint="последний курс"
            color={(stats?.finishing_count ?? 0) > 0 ? 'amber' : 'gray'}
          />
        </Reveal>
      </Grid>

      {/* Выпускники: разобрать до сентября, пока они не ушли в архив молча */}
      <Reveal delay={0.1}>
        <Box mt="5">
          <GlowCard padding={24}>
            <FinishingStudies onChange={load} />
          </GlowCard>
        </Box>
      </Reveal>

      {/* Разрез по деректоратам */}
      <Reveal delay={0.1}>
        <Box mt="5">
          <GlowCard padding={24}>
            <Flex align="center" justify="between" mb="3" wrap="wrap" gap="2">
              <Flex align="center" gap="2">
                <BarChartIcon />
                <Heading size="4">По деректоратам</Heading>
              </Flex>
              <Link asChild size="2">
                <RouterLink to="/reports">Подробнее</RouterLink>
              </Link>
            </Flex>

            {withFacultyData.length === 0 ? (
              <Callout.Root color="gray" variant="surface">
                <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
                <Callout.Text>
                  Пока никто не привязан к деректорату. Проверьте записи
                  с неполными данными в «Плательщиках».
                </Callout.Text>
              </Callout.Root>
            ) : (
              <Box style={{ overflowX: 'auto' }}>
                <Table.Root variant="ghost" size="1">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Деректорат</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Участники</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Бюджет</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Платники</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Должники</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Сумма</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {withFacultyData.map((row) => (
                      <Table.Row key={row.faculty_id}>
                        <Table.Cell>
                          <Link asChild>
                            <RouterLink to={`/payers?faculty=${row.faculty_id}`}>
                              {row.faculty_name}
                            </RouterLink>
                          </Link>
                        </Table.Cell>
                        <Table.Cell justify="end">{row.total_payers}</Table.Cell>
                        <Table.Cell justify="end">
                          <Text color="green">{row.budget_count}</Text>
                        </Table.Cell>
                        <Table.Cell justify="end">{row.paying_count}</Table.Cell>
                        <Table.Cell justify="end">
                          {row.debtors_count > 0
                            ? <Badge color="red" variant="soft">{row.debtors_count}</Badge>
                            : <Text color="gray">0</Text>}
                        </Table.Cell>
                        <Table.Cell justify="end">{money(row.total_amount)}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>
            )}
          </GlowCard>
        </Box>
      </Reveal>
    </Box>
  );
}
