import React from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  size = 'md', 
  className = '',
  children,
  onClick,
  type = 'button',
  disabled = false
}) => {
  const baseClasses = 'font-bold rounded-xl transition-all disabled:opacity-50';
  
  const variantClasses = {
    primary: 'px-4 py-2 sm:px-6 sm:py-3 bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95',
    secondary: 'px-4 py-2 sm:px-6 sm:py-3 bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'px-4 py-2 sm:px-6 sm:py-3 bg-red-600 text-white hover:bg-red-700',
    ghost: 'px-4 py-2 sm:px-6 sm:py-3 text-slate-400 hover:text-slate-600',
  };

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;
