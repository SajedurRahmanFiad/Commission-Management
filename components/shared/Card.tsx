import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  hover = false,
  clickable = false,
  onClick 
}) => {
  const hoverClass = (hover || clickable) ? 'hover:shadow-lg hover:border-indigo-200 transition-all' : '';
  const cursorClass = clickable ? 'cursor-pointer' : '';

  return (
    <div 
      className={`bg-white rounded-[2rem] border border-slate-200 shadow-sm ${hoverClass} ${cursorClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;
