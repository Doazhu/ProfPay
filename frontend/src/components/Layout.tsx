import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { HamburgerMenuIcon } from '@radix-ui/react-icons';
import { Flex, IconButton, Text } from '@radix-ui/themes';
import Sidebar from './Sidebar';
import { ThemeToggleButton } from './ThemeToggle';

export default function Layout() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-background)' }}>
      {/* Боковое меню: на широком экране всегда, на узком — выдвижное */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <div className="md:hidden">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Шапка для узкого экрана */}
        <Flex
          align="center"
          gap="3"
          px="4"
          py="3"
          className="md:hidden"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: 'var(--color-panel-solid)',
            borderBottom: '1px solid var(--gray-a5)',
          }}
        >
          <IconButton
            variant="ghost"
            color="gray"
            onClick={() => setSidebarOpen(true)}
            aria-label="Открыть меню"
          >
            <HamburgerMenuIcon width="20" height="20" />
          </IconButton>
          <Text weight="bold" size="3">ProfPay</Text>
          <Flex ml="auto">
            <ThemeToggleButton />
          </Flex>
        </Flex>

        <main style={{ flex: 1, overflow: 'auto' }}>
          <div className="p-4 md:p-6" style={{ maxWidth: 1400 }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
