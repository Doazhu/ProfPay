import React from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigationError, useNavigationThrottle } from '../hooks/useNavigationError';

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

interface MenuItem {
  id: string;
  path: string;
  icon: string;
  label: string;
}

const menuItems: MenuItem[] = [
  { id: 'home', path: '/', icon: '🏠', label: 'Главная' },
  { id: 'payers', path: '/payers', icon: '👥', label: 'Плательщики' },
  { id: 'reports', path: '/reports', icon: '📊', label: 'Отчёты' },
  { id: 'notifications', path: '/notifications', icon: '🔔', label: 'Уведомления' },
  { id: 'settings', path: '/settings', icon: '⚙️', label: 'Настройки' },
];

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed = false, onToggle }) => {
  const location = useLocation();
  const { safeNavigate } = useNavigationError();
  const { throttledNavigate } = useNavigationThrottle();

  // Determine active item based on current URL path
  const getActiveItem = (currentPath: string): string => {
    const activeMenuItem = menuItems.find(item => item.path === currentPath);
    return activeMenuItem ? activeMenuItem.id : 'home';
  };

  const activeItem = getActiveItem(location.pathname);

  // Handle navigation when menu item is clicked with error handling and throttling
  const handleMenuItemClick = (path: string) => {
    // Предотвращаем навигацию если уже находимся на этой странице
    if (location.pathname === path) {
      return;
    }

    throttledNavigate(() => {
      safeNavigate(path);
    });
  };

  return (
    <aside className={`bg-primary h-full transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'} flex flex-col`}>
      <div className="p-4">
        <button
          onClick={onToggle}
          className="text-white hover:text-accent-solid transition-colors duration-200 w-full text-left"
        >
          {isCollapsed ? '☰' : '←'}
        </button>
      </div>

      <nav className="flex-1">
        {menuItems.map((item) => {
          const isActive = activeItem === item.id;
          const isCurrentPage = location.pathname === item.path;
          
          return (
            <div key={item.id} className="relative group">
              <button
                onClick={() => handleMenuItemClick(item.path)}
                disabled={isCurrentPage}
                className={`w-full flex items-center px-4 py-3 text-white transition-colors duration-200 ${
                  isActive 
                    ? 'bg-white bg-opacity-20 border-r-2 border-accent-solid' 
                    : 'hover:bg-white hover:bg-opacity-10'
                } ${
                  isCurrentPage 
                    ? 'cursor-default' 
                    : 'cursor-pointer'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {!isCollapsed && <span className="ml-3 text-sm">{item.label}</span>}
              </button>

              {/* Tooltip для свернутого состояния */}
              {isCollapsed && (
                <div className="absolute left-full top-0 ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                  {item.label}
                  {isCurrentPage && <span className="ml-1 text-accent-solid">•</span>}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;