import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Список валидных маршрутов
const VALID_ROUTES = [
  '/',
  '/payers',
  '/reports',
  '/notifications',
  '/settings'
];

// Хук для обработки ошибок навигации
export const useNavigationError = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Проверяем, является ли текущий маршрут валидным
    const isValidRoute = VALID_ROUTES.includes(location.pathname) || 
                        location.pathname.startsWith('/payers/'); // Поддержка подмаршрутов

    // Логируем навигационные события для отладки
    console.log('Navigation to:', location.pathname, 'Valid:', isValidRoute);

    // Если маршрут невалидный и это не уже страница 404
    if (!isValidRoute && !location.pathname.includes('404')) {
      console.warn('Invalid route detected:', location.pathname);
    }
  }, [location.pathname]);

  // Функция для безопасной навигации с обработкой ошибок
  const safeNavigate = (to: string, options?: { replace?: boolean }) => {
    try {
      // Проверяем, является ли целевой маршрут валидным
      if (VALID_ROUTES.includes(to)) {
        navigate(to, options);
      } else {
        console.warn('Attempted navigation to invalid route:', to);
        navigate('/', { replace: true }); // Fallback на главную страницу
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // В случае ошибки навигации, перенаправляем на главную
      navigate('/', { replace: true });
    }
  };

  // Функция для обработки ошибок при переходе назад
  const safeGoBack = () => {
    try {
      // Проверяем, есть ли история для возврата
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        // Если истории нет, переходим на главную
        navigate('/', { replace: true });
      }
    } catch (error) {
      console.error('Go back error:', error);
      navigate('/', { replace: true });
    }
  };

  return {
    safeNavigate,
    safeGoBack,
    currentPath: location.pathname,
    isValidRoute: VALID_ROUTES.includes(location.pathname)
  };
};

// Хук для предотвращения множественных кликов
export const useNavigationThrottle = (delay: number = 300) => {
  let lastNavigationTime = 0;

  const throttledNavigate = (callback: () => void) => {
    const now = Date.now();
    if (now - lastNavigationTime >= delay) {
      lastNavigationTime = now;
      callback();
    } else {
      console.log('Navigation throttled - too many rapid clicks');
    }
  };

  return { throttledNavigate };
};