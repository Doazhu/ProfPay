import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

// Burger menu icon
const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const openSidebar = () => setIsSidebarOpen(true);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="flex min-h-screen" style={{ background: 'linear-gradient(135deg, #F0F2F5 0%, #E8EDF4 50%, #F0F2F5 100%)' }}>
      {/* Desktop sidebar - always visible on md+ */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar - controlled by state */}
      <div className="md:hidden">
        <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header with glassmorphism */}
        <header className="md:hidden sticky top-0 z-30 px-4 py-3 flex items-center gap-3 border-b border-white/60"
          style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
        >
          <button
            onClick={openSidebar}
            className="p-2 -ml-2 rounded-xl text-accent hover:bg-light-dark/50 active:bg-light-darker touch-target"
            aria-label="Открыть меню"
          >
            <MenuIcon />
          </button>
          <h1 className="text-lg font-bold text-primary">ProfPay</h1>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
