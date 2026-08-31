import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ActivityLogIcon, ArchiveIcon, BarChartIcon, ChevronRightIcon, Cross1Icon,
  DotsHorizontalIcon, ExclamationTriangleIcon, ExitIcon, GearIcon, HomeIcon,
  LockClosedIcon, PersonIcon, PlusIcon,
} from '@radix-ui/react-icons';
import { Box, Flex, IconButton, Text } from '@radix-ui/themes';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggleButton } from './ThemeToggle';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

function NavItem({ to, icon, label, onClick }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) => (isActive ? 'sidebar-link-active' : 'sidebar-link')}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  operator: 'Оператор',
  viewer: 'Только просмотр',
};

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const { user, logout, canEdit, isAdmin } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const handleNavClick = () => onClose?.();
  const isDrawer = Boolean(onClose);

  return (
    <>
      {isDrawer && isOpen && (
        <div
          className="animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
          style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'var(--color-overlay)' }}
        />
      )}

      <aside
        style={{
          position: isDrawer ? 'fixed' : 'sticky',
          top: 0,
          left: 0,
          zIndex: 50,
          width: 236,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          background: 'var(--color-panel-solid)',
          borderRight: '1px solid var(--gray-a5)',
          transform: isDrawer && !isOpen ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform var(--dur-2) var(--ease)',
        }}
      >
        {/* Шапка */}
        <Flex align="center" justify="between" px="3" py="3"
              style={{ borderBottom: '1px solid var(--gray-a5)' }}>
          <Flex align="center" gap="2">
            <Flex
              align="center" justify="center"
              style={{
                width: 30, height: 30,
                borderRadius: 'var(--radius-3)',
                background: 'var(--accent-9)',
                color: 'var(--accent-contrast)',
                fontWeight: 700, fontSize: 14,
              }}
            >
              P
            </Flex>
            <Box>
              <Text as="div" size="2" weight="bold">ProfPay</Text>
              <Text as="div" size="1" color="gray">Учёт взносов</Text>
            </Box>
          </Flex>

          <Flex align="center" gap="1">
            {!isDrawer && <ThemeToggleButton />}
            {isDrawer && (
              <IconButton variant="ghost" color="gray" onClick={onClose} aria-label="Закрыть меню">
                <Cross1Icon />
              </IconButton>
            )}
          </Flex>
        </Flex>

        {/*
          Навигация в два уровня. Наверху то, что открывают каждый день;
          редкое убрано под «Остальное», чтобы ежедневные пункты не приходилось
          выискивать среди отчётов и настроек.
        */}
        <nav
          className="scrollbar-thin"
          style={{
            flex: 1, overflowY: 'auto', padding: '10px 8px',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}
        >
          <NavItem to="/" icon={<HomeIcon />} label="Главная" onClick={handleNavClick} />
          <NavItem to="/payers" icon={<PersonIcon />} label="Плательщики" onClick={handleNavClick} />
          <NavItem to="/debtors" icon={<ExclamationTriangleIcon />} label="Должники" onClick={handleNavClick} />
          {canEdit && (
            <NavItem to="/add-payer" icon={<PlusIcon />} label="Добавить" onClick={handleNavClick} />
          )}

          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className="sidebar-link"
            style={{ marginTop: 8, width: '100%', border: 'none', background: 'transparent' }}
            aria-expanded={moreOpen}
          >
            <DotsHorizontalIcon />
            <span>Остальное</span>
            <ChevronRightIcon
              style={{
                marginLeft: 'auto',
                transform: moreOpen ? 'rotate(90deg)' : 'none',
                transition: 'transform var(--dur-1) var(--ease)',
              }}
            />
          </button>

          {moreOpen && (
            <Box
              className="animate-expand"
              style={{
                marginLeft: 14, paddingLeft: 8,
                borderLeft: '1px solid var(--gray-a5)',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}
            >
              <NavItem to="/reports" icon={<BarChartIcon />} label="Отчёты" onClick={handleNavClick} />
              <NavItem to="/archive" icon={<ArchiveIcon />} label="Архив выпускников" onClick={handleNavClick} />
              <NavItem to="/change-password" icon={<LockClosedIcon />} label="Пароль и вход" onClick={handleNavClick} />
              {isAdmin && (
                <>
                  <NavItem to="/users" icon={<PersonIcon />} label="Пользователи" onClick={handleNavClick} />
                  <NavItem to="/settings" icon={<GearIcon />} label="Настройки" onClick={handleNavClick} />
                  <NavItem to="/audit" icon={<ActivityLogIcon />} label="Журнал изменений" onClick={handleNavClick} />
                </>
              )}
            </Box>
          )}
        </nav>

        {/* Кто вошёл */}
        <Box px="2" py="3" style={{ borderTop: '1px solid var(--gray-a5)' }}>
          <Box px="3" pb="2">
            <Text as="div" size="2" weight="medium" truncate>
              {user?.full_name || 'Пользователь'}
            </Text>
            <Text as="div" size="1" color="gray">
              {ROLE_LABELS[user?.role ?? ''] ?? '—'}
            </Text>
          </Box>
          <button
            type="button"
            onClick={logout}
            className="sidebar-link"
            style={{ width: '100%', border: 'none', background: 'transparent', color: 'var(--red-11)' }}
          >
            <ExitIcon />
            <span>Выйти</span>
          </button>
        </Box>
      </aside>
    </>
  );
}
