import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200 py-4 px-6 mt-auto">
      <div className="flex justify-between items-center text-sm text-gray-600">
        <div>
          © 2025 ProfPay. Система управления платежами профсоюза.
        </div>
        <div className="flex gap-4">
          <a href="#" className="hover:text-accent-solid transition-colors duration-200">
            Поддержка
          </a>
          <a href="#" className="hover:text-accent-solid transition-colors duration-200">
            Документация
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;