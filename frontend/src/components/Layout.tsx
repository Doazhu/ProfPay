import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header 
        userName="Администратор"
        onProfileClick={() => console.log('Открыть профиль')}
        onLogout={() => console.log('Выйти')}
      />
      
      <div className="flex flex-1">
        <Sidebar 
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </div>
      
      <Footer />
    </div>
  );
};

export default Layout;