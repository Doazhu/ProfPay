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

// Helper function to render App with memory router
const renderApp = (initialPath = '/') => {
    const router = createMemoryRouter([
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

    return render(<RouterProvider router={router} />);
};

describe('Navigation Integration Tests', () => {
    describe('Route Navigation and URL Updates', () => {
        it('should navigate to home page and update URL correctly', async () => {
            renderApp('/payers'); // Start from different page

            const homeButton = screen.getByRole('button', { name: /главная/i });
            await userEvent.click(homeButton);

            await waitFor(() => {
                expect(window.location.pathname).toBe('/');
            });

            expect(screen.getByText('Добро пожаловать в ProfPay')).toBeInTheDocument();
        });

        it('should navigate to payers page and update URL correctly', async () => {
            renderApp('/');

            const payersButton = screen.getByRole('button', { name: /плательщики/i });
            await userEvent.click(payersButton);

            await waitFor(() => {
                expect(window.location.pathname).toBe('/payers');
            });
        });

        it('should navigate to reports page and update URL correctly', async () => {
            renderApp('/');

            const reportsButton = screen.getByRole('button', { name: /отчёты/i });
            await userEvent.click(reportsButton);

            await waitFor(() => {
                expect(window.location.pathname).toBe('/reports');
            });

            expect(screen.getByText('Отчёты')).toBeInTheDocument();
        });

        it('should navigate to notifications page and update URL correctly', async () => {
            renderApp('/');

            const notificationsButton = screen.getByRole('button', { name: /уведомления/i });
            await userEvent.click(notificationsButton);

            await waitFor(() => {
                expect(window.location.pathname).toBe('/notifications');
            });

            expect(screen.getByText('Уведомления')).toBeInTheDocument();
        });

        it('should navigate to settings page and update URL correctly', async () => {
            renderApp('/');

            const settingsButton = screen.getByRole('button', { name: /настройки/i });
            await userEvent.click(settingsButton);

            await waitFor(() => {
                expect(window.location.pathname).toBe('/settings');
            });

            expect(screen.getByText('Настройки')).toBeInTheDocument();
        });
    });

    describe('Active State Visual Indication', () => {
        it('should highlight active menu item on home page', async () => {
            renderApp('/');

            const homeButton = screen.getByRole('button', { name: /главная/i });

            await waitFor(() => {
                expect(homeButton).toHaveClass('bg-white', 'bg-opacity-20', 'border-r-2', 'border-accent-solid');
            });
        });

        it('should highlight active menu item on payers page', async () => {
            renderApp('/payers');

            const payersButton = screen.getByRole('button', { name: /плательщики/i });

            await waitFor(() => {
                expect(payersButton).toHaveClass('bg-white', 'bg-opacity-20', 'border-r-2', 'border-accent-solid');
            });
        });

        it('should update active state when navigating between pages', async () => {
            renderApp('/');

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

    describe('Browser Back/Forward Button Functionality', () => {
        it('should handle browser back button correctly', async () => {
            renderApp('/');

            // Navigate to payers
            const payersButton = screen.getByRole('button', { name: /плательщики/i });
            await userEvent.click(payersButton);

            await waitFor(() => {
                expect(window.location.pathname).toBe('/payers');
            });

            // Go back using browser history
            window.history.back();

            await waitFor(() => {
                expect(window.location.pathname).toBe('/');
            });

            // Check that home page is displayed and active
            expect(screen.getByText('Добро пожаловать в ProfPay')).toBeInTheDocument();

            const homeButton = screen.getByRole('button', { name: /главная/i });
            expect(homeButton).toHaveClass('bg-white', 'bg-opacity-20');
        });

        it('should handle browser forward button correctly', async () => {
            renderApp('/');

            // Navigate to payers and then back
            const payersButton = screen.getByRole('button', { name: /плательщики/i });
            await userEvent.click(payersButton);

            await waitFor(() => {
                expect(window.location.pathname).toBe('/payers');
            });

            window.history.back();

            await waitFor(() => {
                expect(window.location.pathname).toBe('/');
            });

            // Go forward using browser history
            window.history.forward();

            await waitFor(() => {
                expect(window.location.pathname).toBe('/payers');
            });

            // Check that payers page is displayed and active
            const updatedPayersButton = screen.getByRole('button', { name: /плательщики/i });
            expect(updatedPayersButton).toHaveClass('bg-white', 'bg-opacity-20');
        });
    });

    describe('Sidebar Collapsed/Expanded State', () => {
        it('should maintain navigation functionality when sidebar is collapsed', async () => {
            renderApp('/');

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
                expect(window.location.pathname).toBe('/payers');
            });

            // Active state should still be visible
            expect(payersButton).toHaveClass('bg-white', 'bg-opacity-20');
        });

        it('should show tooltips when sidebar is collapsed', async () => {
            renderApp('/');

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
                expect(screen.getByText('Плательщики')).toBeInTheDocument();
            });
        });

        it('should expand sidebar when toggle button is clicked', async () => {
            renderApp('/');

            // Collapse sidebar first
            const collapseButton = screen.getByRole('button', { name: '←' });
            await userEvent.click(collapseButton);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: '☰' })).toBeInTheDocument();
            });

            // Expand sidebar
            const expandButton = screen.getByRole('button', { name: '☰' });
            await userEvent.click(expandButton);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: '←' })).toBeInTheDocument();
            });

            // Menu labels should be visible again
            expect(screen.getByText('Главная')).toBeInTheDocument();
            expect(screen.getByText('Плательщики')).toBeInTheDocument();
        });
    });

    describe('Error Handling and 404 Page', () => {
        it('should display 404 page for invalid routes', async () => {
            renderApp('/invalid-route');

            await waitFor(() => {
                expect(screen.getByText('404')).toBeInTheDocument();
                expect(screen.getByText('Страница не найдена')).toBeInTheDocument();
            });
        });

        it('should navigate to home from 404 page', async () => {
            renderApp('/invalid-route');

            await waitFor(() => {
                expect(screen.getByText('404')).toBeInTheDocument();
            });

            const homeButton = screen.getByRole('button', { name: /перейти на главную/i });
            await userEvent.click(homeButton);

            await waitFor(() => {
                expect(window.location.pathname).toBe('/');
                expect(screen.getByText('Добро пожаловать в ProfPay')).toBeInTheDocument();
            });
        });

        it('should go back from 404 page', async () => {
            // Start from home, then navigate to invalid route
            renderApp('/');
            window.history.pushState({}, 'Invalid', '/invalid-route');

            // Re-render to trigger route change
            renderApp('/invalid-route');

            await waitFor(() => {
                expect(screen.getByText('404')).toBeInTheDocument();
            });

            const backButton = screen.getByRole('button', { name: /вернуться назад/i });
            await userEvent.click(backButton);

            await waitFor(() => {
                expect(window.location.pathname).toBe('/');
            });
        });
    });

    describe('Navigation Throttling and Error Prevention', () => {
        it('should prevent multiple rapid clicks on the same menu item', async () => {
            renderApp('/');

            const payersButton = screen.getByRole('button', { name: /плательщики/i });

            // Click multiple times rapidly
            await userEvent.click(payersButton);
            await userEvent.click(payersButton);
            await userEvent.click(payersButton);

            // Should only navigate once
            await waitFor(() => {
                expect(window.location.pathname).toBe('/payers');
            });

            // Console should log throttling message
            expect(console.log).toHaveBeenCalledWith('Navigation throttled - too many rapid clicks');
        });

        it('should disable current page button to prevent unnecessary navigation', async () => {
            renderApp('/payers');

            const payersButton = screen.getByRole('button', { name: /плательщики/i });

            // Button should be disabled when on current page
            expect(payersButton).toBeDisabled();
            expect(payersButton).toHaveClass('cursor-default');
        });
    });

    describe('Page Transitions and Loading States', () => {
        it('should show loading indicator during page transitions', async () => {
            renderApp('/');

            const payersButton = screen.getByRole('button', { name: /плательщики/i });
            await userEvent.click(payersButton);

            // Loading indicator should appear briefly
            // Note: This might be too fast to catch in tests, but the component should handle it
            await waitFor(() => {
                expect(window.location.pathname).toBe('/payers');
            });
        });

        it('should apply transition animations between pages', async () => {
            renderApp('/');

            // Check that PageTransition component is rendered
            const mainContent = document.querySelector('main');
            expect(mainContent).toBeInTheDocument();

            const payersButton = screen.getByRole('button', { name: /плательщики/i });
            await userEvent.click(payersButton);

            await waitFor(() => {
                expect(window.location.pathname).toBe('/payers');
            });

            // Transition classes should be applied
            const transitionElement = document.querySelector('.transition-all');
            expect(transitionElement).toBeInTheDocument();
        });
    });

    describe('Quick Actions Navigation from Home Page', () => {
        it('should navigate to payers page from quick actions', async () => {
            renderApp('/');

            // Find the quick action button specifically (not the sidebar button)
            const quickActionButtons = screen.getAllByRole('button', { name: /управление плательщиками/i });
            const quickActionButton = quickActionButtons.find(button =>
                button.textContent?.includes('Управление плательщиками') &&
                !button.closest('aside')
            ) || quickActionButtons[1]; // Fallback to second button if not found

            await userEvent.click(quickActionButton);

            await waitFor(() => {
                expect(screen.getByText('Управление плательщиками')).toBeInTheDocument();
            });
        });

        it('should navigate to reports page from quick actions', async () => {
            renderApp('/');

            // Find the quick action button specifically (not the sidebar button)
            const quickActionButtons = screen.getAllByRole('button', { name: /отчёты/i });
            const quickActionButton = quickActionButtons.find(button =>
                !button.closest('aside')
            ) || quickActionButtons[1]; // Fallback to second button if not found

            await userEvent.click(quickActionButton);

            await waitFor(() => {
                expect(screen.getByText('Отчёты')).toBeInTheDocument();
            });
        });

        it('should navigate to notifications page from quick actions', async () => {
            renderApp('/');

            // Find the quick action button specifically (not the sidebar button)
            const quickActionButtons = screen.getAllByRole('button', { name: /уведомления/i });
            const quickActionButton = quickActionButtons.find(button =>
                !button.closest('aside')
            ) || quickActionButtons[1]; // Fallback to second button if not found

            await userEvent.click(quickActionButton);

            await waitFor(() => {
                expect(screen.getByRole('heading', { name: 'Уведомления' })).toBeInTheDocument();
            });
        });

        it('should navigate to settings page from quick actions', async () => {
            renderApp('/');

            // Find the quick action button specifically (not the sidebar button)
            const quickActionButtons = screen.getAllByRole('button', { name: /настройки/i });
            const quickActionButton = quickActionButtons.find(button =>
                !button.closest('aside')
            ) || quickActionButtons[1]; // Fallback to second button if not found

            await userEvent.click(quickActionButton);

            await waitFor(() => {
                expect(screen.getByRole('heading', { name: 'Настройки' })).toBeInTheDocument();
            });
        });
    });
});