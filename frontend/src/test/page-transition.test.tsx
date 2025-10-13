import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import { usePageTransition } from '../hooks/usePageTransition';

// Mock the usePageTransition hook
vi.mock('../hooks/usePageTransition', () => ({
    usePageTransition: vi.fn(),
}));

const mockUsePageTransition = vi.mocked(usePageTransition);

beforeEach(() => {
    vi.clearAllMocks();
});

describe('PageTransition Component Tests', () => {
    it('should render children when not loading or transitioning', () => {
        mockUsePageTransition.mockReturnValue({
            isLoading: false,
            isTransitioning: false,
            previousPath: null,
            startTransition: vi.fn(),
        });

        render(
            <BrowserRouter>
                <PageTransition>
                    <div>Test Content</div>
                </PageTransition>
            </BrowserRouter>
        );

        expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should show loading indicator when loading', () => {
        mockUsePageTransition.mockReturnValue({
            isLoading: true,
            isTransitioning: false,
            previousPath: null,
            startTransition: vi.fn(),
        });

        render(
            <BrowserRouter>
                <PageTransition>
                    <div>Test Content</div>
                </PageTransition>
            </BrowserRouter>
        );

        expect(screen.getByText('Переключение раздела...')).toBeInTheDocument();
        expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should apply transition classes when transitioning', () => {
        mockUsePageTransition.mockReturnValue({
            isLoading: false,
            isTransitioning: true,
            previousPath: '/',
            startTransition: vi.fn(),
        });

        render(
            <BrowserRouter>
                <PageTransition>
                    <div>Test Content</div>
                </PageTransition>
            </BrowserRouter>
        );

        const contentDiv = screen.getByText('Test Content').parentElement;
        expect(contentDiv).toHaveClass('opacity-0', 'transform', 'translate-y-2');
    });

    it('should apply normal classes when not transitioning', () => {
        mockUsePageTransition.mockReturnValue({
            isLoading: false,
            isTransitioning: false,
            previousPath: '/',
            startTransition: vi.fn(),
        });

        render(
            <BrowserRouter>
                <PageTransition>
                    <div>Test Content</div>
                </PageTransition>
            </BrowserRouter>
        );

        const contentDiv = screen.getByText('Test Content').parentElement;
        expect(contentDiv).toHaveClass('opacity-100', 'transform', 'translate-y-0');
    });

    it('should show both loading indicator and apply transition classes when both states are true', () => {
        mockUsePageTransition.mockReturnValue({
            isLoading: true,
            isTransitioning: true,
            previousPath: '/',
            startTransition: vi.fn(),
        });

        render(
            <BrowserRouter>
                <PageTransition>
                    <div>Test Content</div>
                </PageTransition>
            </BrowserRouter>
        );

        expect(screen.getByText('Переключение раздела...')).toBeInTheDocument();

        const contentDiv = screen.getByText('Test Content').parentElement;
        expect(contentDiv).toHaveClass('opacity-0', 'transform', 'translate-y-2');
    });
});