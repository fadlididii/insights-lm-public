
import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Logo = ({ size = 'md', className = '' }: LogoProps) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8', 
    lg: 'w-12 h-12'
  };

  const iconSizes = {
    sm: '16px',
    md: '20px',
    lg: '28px'
  };

  return (
    <div className={`${sizeClasses[size]} bg-red-600 rounded-full flex items-center justify-center ${className}`}>
      {/* Telkomsel Logo SVG */}
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        height={iconSizes[size]} 
        viewBox="0 0 100 100" 
        width={iconSizes[size]} 
        fill="#FFFFFF"
      >
        {/* Simplified Telkomsel T logo */}
        <path d="M20 20 L80 20 L80 35 L57.5 35 L57.5 80 L42.5 80 L42.5 35 L20 35 Z" />
      </svg>
    </div>
  );
};

export default Logo;
