import React from 'react';

interface HeaderProps {
  userName?: string;
  onProfileClick?: () => void;
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({ userName, onProfileClick, onLogout }) => {
  return (
    <header className="bg-primary h-14 flex items-center justify-between px-6 shadow-soft">
      <div className="flex items-center">
        <h1 className="text-white text-xl font-semibold">ProfPay</h1>
      </div>
      
      <div className="flex items-center space-x-4">
        {userName ? (
          <div className="flex items-center space-x-3">
            <button
              onClick={onProfileClick}
              className="text-white hover:text-accent-solid transition-colors duration-200 text-sm"
            >
              {userName}
            </button>
            <button
              onClick={onLogout}
              className="text-white hover:text-red-300 transition-colors duration-200 text-sm"
            >
              Выход
            </button>
          </div>
        ) : (
          <button className="bg-accent text-white px-4 py-2 rounded-custom hover:bg-accent-solid transition-colors duration-200">
            Войти
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;