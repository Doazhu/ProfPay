import React from 'react';
import { usePageTransition } from '../hooks/usePageTransition';
import LoadingIndicator from './LoadingIndicator';

interface PageTransitionProps {
  children: React.ReactNode;
}

const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const { isLoading, isTransitioning } = usePageTransition();

  return (
    <div className="relative w-full h-full">
      {/* Индикатор загрузки */}
      {isLoading && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-white bg-opacity-90 backdrop-blur-sm">
          <LoadingIndicator 
            isVisible={true} 
            message="Переключение раздела..." 
            size="small"
            variant="spinner"
          />
        </div>
      )}

      {/* Контент страницы с анимацией перехода */}
      <div 
        className={`transition-all duration-300 ease-in-out ${
          isTransitioning 
            ? 'opacity-0 transform translate-y-2' 
            : 'opacity-100 transform translate-y-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
};

export default PageTransition;