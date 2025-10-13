import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useNavigationError, useNavigationThrottle } from '../hooks/useNavigationError';

// Mock console methods
beforeEach(() => {
  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
});

// Wrapper component for hooks that need Router context
const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('Navigation Hooks Tests', () => {
  describe('useNavigationError Hook', () => {
    it('should provide safe navigation function', () => {
      const { result } = renderHook(() => useNavigationError(), {
        wrapper: RouterWrapper,
      });

      expect(result.current.safeNavigate).toBeDefined();
      expect(result.current.safeGoBack).toBeDefined();
      expect(result.current.currentPath).toBeDefined();
      expect(result.current.isValidRoute).toBeDefined();
    });

    it('should identify valid routes correctly', () => {
      // Mock location to test different paths
      Object.defineProperty(window, 'location', {
        value: { pathname: '/' },
        writable: true,
      });

      const { result } = renderHook(() => useNavigationError(), {
        wrapper: RouterWrapper,
      });

      expect(result.current.isValidRoute).toBe(true);
    });

    it('should handle safe navigation to valid routes', () => {
      const { result } = renderHook(() => useNavigationError(), {
        wrapper: RouterWrapper,
      });

      act(() => {
        result.current.safeNavigate('/payers');
      });

      // Should not throw error and should log navigation
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Navigation to:'),
        expect.any(String),
        expect.stringContaining('Valid:'),
        expect.any(Boolean)
      );
    });

    it('should handle navigation to invalid routes by redirecting to home', () => {
      const { result } = renderHook(() => useNavigationError(), {
        wrapper: RouterWrapper,
      });

      act(() => {
        result.current.safeNavigate('/invalid-route');
      });

      // Should warn about invalid route
      expect(console.warn).toHaveBeenCalledWith(
        'Attempted navigation to invalid route:',
        '/invalid-route'
      );
    });

    it('should handle safe go back functionality', () => {
      // Mock window.history
      const mockHistory = {
        length: 2,
      };
      Object.defineProperty(window, 'history', {
        value: mockHistory,
        writable: true,
      });

      const { result } = renderHook(() => useNavigationError(), {
        wrapper: RouterWrapper,
      });

      act(() => {
        result.current.safeGoBack();
      });

      // Should not throw error
      expect(result.current.safeGoBack).toBeDefined();
    });

    it('should redirect to home when no history available', () => {
      // Mock window.history with no previous entries
      const mockHistory = {
        length: 1,
      };
      Object.defineProperty(window, 'history', {
        value: mockHistory,
        writable: true,
      });

      const { result } = renderHook(() => useNavigationError(), {
        wrapper: RouterWrapper,
      });

      act(() => {
        result.current.safeGoBack();
      });

      // Should handle the case gracefully
      expect(result.current.safeGoBack).toBeDefined();
    });
  });

  describe('useNavigationThrottle Hook', () => {
    it('should provide throttled navigate function', () => {
      const { result } = renderHook(() => useNavigationThrottle());

      expect(result.current.throttledNavigate).toBeDefined();
      expect(typeof result.current.throttledNavigate).toBe('function');
    });

    it('should execute callback immediately on first call', () => {
      const { result } = renderHook(() => useNavigationThrottle(100));
      const mockCallback = vi.fn();

      act(() => {
        result.current.throttledNavigate(mockCallback);
      });

      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should throttle rapid successive calls', () => {
      const { result } = renderHook(() => useNavigationThrottle(100));
      const mockCallback = vi.fn();

      act(() => {
        result.current.throttledNavigate(mockCallback);
        result.current.throttledNavigate(mockCallback);
        result.current.throttledNavigate(mockCallback);
      });

      // Should only execute once due to throttling
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith('Navigation throttled - too many rapid clicks');
    });

    it('should allow execution after throttle delay', async () => {
      const { result } = renderHook(() => useNavigationThrottle(50));
      const mockCallback = vi.fn();

      act(() => {
        result.current.throttledNavigate(mockCallback);
      });

      expect(mockCallback).toHaveBeenCalledTimes(1);

      // Wait for throttle delay to pass
      await new Promise(resolve => setTimeout(resolve, 60));

      act(() => {
        result.current.throttledNavigate(mockCallback);
      });

      expect(mockCallback).toHaveBeenCalledTimes(2);
    });

    it('should use default delay when not specified', () => {
      const { result } = renderHook(() => useNavigationThrottle());
      const mockCallback = vi.fn();

      act(() => {
        result.current.throttledNavigate(mockCallback);
        result.current.throttledNavigate(mockCallback);
      });

      // Should throttle with default 300ms delay
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });
});