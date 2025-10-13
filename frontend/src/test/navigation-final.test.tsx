import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import Layout from '../components/Layout';
import HomePage from '../HomePage';
import PayersPage from '../PayersPage';
import ReportsPage from '../ReportsPage';
import NotificationsPage from '../NotificationsPage';
import SettingsPage from '../SettingsPage';
import NotFoundPage from '../NotFoundPage';

// Mock console methods to avoid noise in tests
beforeEach(() => {
  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
});

// Helper function to create router and render
const createTestRouter = (initialPath = '/') => {
  return createMemoryRouter([
    {
      path: '/',
      element: <Layout><HomePage /></Layout>,
    },
    {
      path: '/payers',
      element: <Layout><PayersPage /></Layout>,
    },
    {
      path: '/reports',
      element: <Layout><ReportsPage /></Layout>,
    },
    {
      path: '/notifications',
      element: <Layout><NotificationsPage /></Layout>,
    },
    {
      path: '/settings',
      element: <Layout><SettingsPage /></Layout>,
    },
    {
      path: '*',
      element: <Layout><NotFoundPage /></Layout>,
    },
  ], {
    initialEntries: [initialPath],
  });
};

describe('Navigation System Integration Tests', () => {
  describe('Basic Route Navigation', () => {
    it('should display home page by default', async () => {
      const router = createTestRouter('/');
      render(<RouterProvider router={router} />);
      
      await waitFor(() => {
        expect(screen.getByText('Добро пожаловать в ProfPay')).toBeInTheDocument();
      });
    });

    it('should navigate to payers page when payers button is clicked', async () => {
      const router = createTestRouter('/');
      render(<RouterProvider router={router} />);
      
      const payersButton = screen.getByRole('button', { name: /плательщики/i });
      await userEvent.click(payersButton);
      
      await waitFor(() => {
        expect(screen.getByText('Управление плательщиками')).toBeInTheDocument();
      });
    });

    it('should navigate to reports page when reports button is clicked', async () => {
      const router = createTestRouter('/');
      render(<RouterProvider router={router} />);
      
      const reportsButton = screen.getByRole('button', { name: /отчёты/i });
      await userEvent.click(reportsButton);
      
      await waitFor(() => {
        expect(screen.getByText('Отчёты')).toBeInTheDocument();
      });
    });

    it('should navigate to notifications page when notifications button is clicked', async () => {
      const router = createTestRouter('/');
      render(<RouterProvider router={router} />);
      
      const notificationsButton = screen.getByRole('button', { name: /уведомления/i });
      await userEvent.click(notificationsButton);
      
      await waitFor(() => {
        expect(screen.getByText('Уведомления')).toBeInTheDocument();
      });
    });

    it('should navigate to settings page when settings button is clicked', async () => {
      const router = createTestRouter('/');
      render(<RouterProvider router={router} />);
      
      const settingsButton = screen.getByRole('button', { name: /настройки/i });
      await userEvent.click(settingsButton);
      
      await waitFor(() => {
        expect(screen.getByText('Настройки')).toBeInTheDocument();
      });
    });
  });

  describe('Active State Visual Indication', () => {
    it('should highlight home button when on home page', async () => {
      const router = createTestRouter('/');
      render(<RouterProvider router={router} />);
      
      const homeButton = screen.getByRole('button', { name: /главная/i });
      
      await waitFor(() => {
        expect(homeButton).toHaveClass('bg-white', 'bg-opacity-20');
      });
    });

    it('should highlight payers button when on payers page', async () => {
      const router = createTestRouter('/payers');
      render(<RouterProvider router={router} />);
      
      const payersButton = screen.getByRole('button', { name: /плательщики/i });
      
      await waitFor(() => {
        expect(payersButton).toHaveClass('bg-white', 'bg-opacity-20');
      });
    });

    it('should update active state when navigating between pages', async () => {
      const router = createTestRouter('/');
      render(<RouterProvider router={router} />);
      
      const homeButton = screen.getByRole('button', { name: /главная/i });
      const payersButton = screen.getByRole('button', { name: /плательщики/i });
      
      // Initially home should be active
      expect(homeButton).toHaveClass('bg-white', 'bg-opacity-20');
      expect(payersButton).not.toHaveClass('bg-white', 'bg-opacity-20');
      
      // Navigate to payers
      await userEvent.click(payersButton);
      
      await waitFor(() => {
        expect(payersButton).toHaveClass('bg-white', 'bg-opacity-20');
        expect(homeButton).not.toHaveClass('bg-white', 'bg-opacity-20');
      });
    });
  });

  describe('Sidebar Collapsed/Expanded State', () => {
    it('should maintain navigation functionality when sidebar is collapsed', async () => {
      const router = createTestRouter('/');
      render(<RouterProvider router={router} />);
      
      // Find and click the collapse button
      const collapseButton = screen.getByRole('button', { name: '←' });
      await userEvent.click(collapseButton);
      
      // Sidebar should now be collapsed, button text should change
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '☰' })).toBeInTheDocument();
      });
      
      // Navigation should still work
      const payersButton = screen.getByRole('button', { name: /плательщики/i });
      await userEvent.click(payersButton);
      
      await waitFor(() => {
        expect(screen.getByText('Управление плательщиками')).toBeInTheDocument();
      });
      
      // Active state should still be visible
      expect(payersButton).toHaveClass('bg-white', 'bg-opacity-20');
    });

    it('should show tooltips when sidebar is collapsed', async () => {
      const router = createTestRouter('/');
      render(<RouterProvider router={router} />);
      
      // Collapse sidebar
      const collapseButton = screen.getByRole('button', { name: '←' });
      await userEvent.click(collapseButton);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '☰' })).toBeInTheDocument();
      });
      
      // Hover over a menu item to show tooltip
      const payersButton = screen.getByRole('button', { name: /плательщики/i });
      await userEvent.hover(payersButton);
      
      // Tooltip should appear (checking for tooltip text)
      await waitFor(() => {
        const tooltips = screen.getAllByText('Плательщики');
        expect(tooltips.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling and 404 Page', () => {
    it('should display 404 page for invalid routes', async () => {
      const router = createTestRouter('/invalid-route');
      render(<RouterProvider router={router} />);
      
      await waitFor(() => {
        expect(screen.getByText('404')).toBeInTheDocument();
        expect(screen.getByText('Страница не найдена')).toBeInTheDocument();
      });
    });

    it('should navigate to home from 404 page', async () => {
      const router = createTestRouter('/invalid-route');
      render(<RouterProvider router={router} />);
      
      await waitFor(() => {
        expect(screen.getByText('404')).toBeInTheDocument();
      });
      
      const homeButton = screen.getByRole('button', { name: /перейти на главную/i });
      await userEvent.click(homeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Добро пожаловать в ProfPay')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Throttling and Error Prevention', () => {
    it('should prevent multiple rapid clicks on the same menu item', async () => {
      const router = createTestRouter('/');
      render(<RouterProvider router={router} />);
      
      const payersButton = screen.getByRole('button', { name: /плательщики/i });
      
      // Click multiple times rapidly
      await userEvent.click(payersButton);
      await userEvent.click(payersButton);
      await userEvent.click(payersButton);
      
      // Should navigate to payers page
      await waitFor(() => {
        expect(screen.getByText('Управление плательщиками')).toBeInTheDocument();
      });
      
      // Console should log throttling message
      expect(console.log).toHaveBeenCalledWith('Navigation throttled - too many rapid clicks');
    });

    it('should disable current page button to prevent unnecessary navigation', async () => {
      const router = createTestRouter('/payers');
      render(<RouterProvider router={router} />);
      
      const payersButton = screen.getByRole('button', { name: /плательщики/i });
      
      // Button should be disabled when on current page
      await waitFor(() => {
        expect(payersButton).toBeDisabled();
        expect(payersButton).toHaveClass('cursor-default');
      });
    });
  });

  describe('Quick Actions Navigation from Home Page', () => {
    it('should navigate to payers page from quick actions', async () => {
      const router = createTestRouter('/');
      render(<RouterProvider router={router} />);
      
      const quickActionButton = screen.getByRole('button', { name: /управление плательщиками/i });
      await userEvent.click(quickActionButton);
      
      await waitFor(() => {
        expect(screen.getByText('Управление плательщиками')).toBeInTheDocument();
      });
    });

    it('should navigate to reports page from quick actions', async () => {
      const router = createTestRouter('/');
      render(<RouterProvider router={router} />);
      
      const quickActionButton = screen.getByRole('button', { name: /отчёты/i });
      await userEvent.click(quickActionButton);
      
      await waitFor(() => {
        expect(screen.getByText('Отчёты')).toBeInTheDocument();
      });
    });

    it('should navigate to notifications page from quick actions', async () => {
      const router = createTestRouter('/');
      render(<RouterProvider router={router} />);
      
      const quickActionButton = screen.getByRole('button', { name: /уведомления/i });
      await userEvent.click(quickActionButton);
      
      await waitFor(() => {
        expect(screen.getByText('Уведомления')).toBeInTheDocument();
      });
    });

    it('should navigate to settings page from quick actions', async () => {
      const router = createTestRouter('/');
      render(<RouterProvider router={router} />);
      
      const quickActionButton = screen.getByRole('button', { name: /настройки/i });
      await userEvent.click(quickActionButton);
      
      await waitFor(() => {
        expect(screen.getByText('Настройки')).toBeInTheDocument();
      });
    });
  });
});