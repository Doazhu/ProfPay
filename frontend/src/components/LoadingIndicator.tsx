import React from 'react';

interface LoadingIndicatorProps {
  isVisible: boolean;
  message?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'spinner' | 'pulse' | 'skeleton';
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  isVisible,
  message = 'Загрузка...',
  size = 'medium',
  variant = 'spinner'
}) => {
  if (!isVisible) return null;

  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-8 h-8'
  };

  const SpinnerLoader = () => (
    <div className="flex items-center justify-center space-x-2">
      <div className={`${sizeClasses[size]} border-2 border-gray-300 border-t-primary rounded-full animate-spin`}></div>
      {message && <span className="text-sm text-gray-600">{message}</span>}
    </div>
  );

  const PulseLoader = () => (
    <div className="flex items-center justify-center space-x-2">
      <div className="flex space-x-1">
        <div className={`${sizeClasses[size]} bg-primary rounded-full animate-pulse`}></div>
        <div className={`${sizeClasses[size]} bg-primary rounded-full animate-pulse`} style={{ animationDelay: '0.1s' }}></div>
        <div className={`${sizeClasses[size]} bg-primary rounded-full animate-pulse`} style={{ animationDelay: '0.2s' }}></div>
      </div>
      {message && <span className="text-sm text-gray-600">{message}</span>}
    </div>
  );

  const SkeletonLoader = () => (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-300 rounded w-1/2 mb-2"></div>
      <div className="h-4 bg-gray-300 rounded w-5/6"></div>
    </div>
  );

  const renderLoader = () => {
    switch (variant) {
      case 'pulse':
        return <PulseLoader />;
      case 'skeleton':
        return <SkeletonLoader />;
      default:
        return <SpinnerLoader />;
    }
  };

  return (
    <div className="flex items-center justify-center p-4">
      {renderLoader()}
    </div>
  );
};

export default LoadingIndicator;