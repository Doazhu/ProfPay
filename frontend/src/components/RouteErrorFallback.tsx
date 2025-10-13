import React from 'react';
import { useNavigate } from 'react-router-dom';

interface RouteErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
}

const RouteErrorFallback: React.FC<RouteErrorFallbackProps> = ({ error, resetError }) => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    if (resetError) {
      resetError();
    }
    navigate('/', { replace: true });
  };

  const handleRetry = () => {
    if (resetError) {
      resetError();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-96 p-6">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <span className="text-2xl">⚠️</span>
          </div>
        </div>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Ошибка загрузки страницы
        </h2>
        
        <p className="text-gray-600 mb-6">
          Произошла ошибка при загрузке содержимого страницы. 
          Попробуйте обновить страницу или перейти на главную.
        </p>
        
        {import.meta.env.DEV && error && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 mb-2">
              Детали ошибки
            </summary>
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-24">
              {error.message}
            </pre>
          </details>
        )}
        
        <div className="space-y-3">
          <button
            onClick={handleRetry}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
          >
            Попробовать снова
          </button>
          
          <button
            onClick={handleGoHome}
            className="w-full flex items-center justify-center px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors duration-200"
          >
            <span className="mr-2">🏠</span>
            На главную
          </button>
        </div>
      </div>
    </div>
  );
};

export default RouteErrorFallback;