import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// SVG Icons as components
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const AlertIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const LogoutIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

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
      onClick={onClick}
      className={({ isActive }) =>
        isActive ? 'sidebar-link-active' : 'sidebar-link'
      }
    >
      {icon}
      <span className="text-sm">{label}</span>
    </NavLink>
  );
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const { user, logout, canEdit, isAdmin } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const handleNavClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-dark/40 z-40 md:hidden animate-fade-in"
          style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-64 bg-white
          flex flex-col
          transform transition-transform duration-300 ease-out
          md:transform-none md:transition-none
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          h-screen md:h-auto md:min-h-screen
          shadow-soft md:shadow-none
        `}
      >
        {/* Logo */}
        <div className="p-5 md:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #1F9788 0%, #2ab8a6 100%)' }}
            >
              P
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark leading-tight">ProfPay</h1>
              <p className="text-xs text-accent">Учёт плательщиков</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-2 -mr-2 rounded-xl text-accent hover:bg-light-dark/50 active:bg-light-darker touch-target"
              aria-label="Закрыть меню"
            >
              <CloseIcon />
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-light-dark" />

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto scrollbar-thin">
          <p className="text-[10px] font-semibold text-accent/60 uppercase tracking-widest px-4 pt-2 pb-2">Меню</p>
          <NavItem to="/" icon={<HomeIcon />} label="Главная" onClick={handleNavClick} />
          <NavItem to="/payers" icon={<UsersIcon />} label="Плательщики" onClick={handleNavClick} />
          <NavItem to="/debtors" icon={<AlertIcon />} label="Должники" onClick={handleNavClick} />

          {canEdit && (
            <NavItem to="/add-payer" icon={<PlusIcon />} label="Добавить" onClick={handleNavClick} />
          )}

          <NavItem to="/reports" icon={<ChartIcon />} label="Отчёты" onClick={handleNavClick} />

          {isAdmin && (
            <>
              <p className="text-[10px] font-semibold text-accent/60 uppercase tracking-widest px-4 pt-4 pb-2">Система</p>
              <NavItem to="/settings" icon={<SettingsIcon />} label="Настройки" onClick={handleNavClick} />
            </>
          )}
        </nav>

        {/* User Info */}
        <div className="p-4">
          <div className="p-3 rounded-xl bg-light/60">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #5852ED 0%, #7a75f1 100%)' }}
              >
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-dark truncate">
                  {user?.full_name || 'Пользователь'}
                </p>
                <p className="text-xs text-accent capitalize">
                  {user?.role === 'admin' ? 'Администратор' :
                   user?.role === 'operator' ? 'Оператор' : 'Просмотр'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 hover:text-red-600 active:bg-red-100 transition-colors duration-150"
            >
              <LogoutIcon />
              <span>Выйти</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
