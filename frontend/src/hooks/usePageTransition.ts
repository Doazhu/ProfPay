import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionState {
    isLoading: boolean;
    isTransitioning: boolean;
    previousPath: string | null;
}

// Хук для управления переходами между страницами
export const usePageTransition = () => {
    const location = useLocation();
    const [state, setState] = useState<PageTransitionState>({
        isLoading: false,
        isTransitioning: false,
        previousPath: null
    });

    // Отслеживаем изменения маршрута
    useEffect(() => {
        let transitionTimer: number;
        let loadingTimer: number;

        // Начинаем переход
        setState(prev => ({
            ...prev,
            isTransitioning: true,
            isLoading: true,
            previousPath: prev.previousPath || location.pathname
        }));

        // Имитируем минимальное время загрузки для плавности
        loadingTimer = window.setTimeout(() => {
            setState(prev => ({
                ...prev,
                isLoading: false
            }));
        }, 150);

        // Завершаем переход
        transitionTimer = window.setTimeout(() => {
            setState(prev => ({
                ...prev,
                isTransitioning: false,
                previousPath: location.pathname
            }));
        }, 300);

        return () => {
            window.clearTimeout(transitionTimer);
            window.clearTimeout(loadingTimer);
        };
    }, [location.pathname]);

    // Функция для программного запуска перехода
    const startTransition = useCallback(() => {
        setState(prev => ({
            ...prev,
            isTransitioning: true,
            isLoading: true
        }));
    }, []);

    return {
        ...state,
        startTransition
    };
};

