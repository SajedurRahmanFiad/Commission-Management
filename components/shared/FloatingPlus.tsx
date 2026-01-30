import React from 'react';
import { Icons } from '../../constants';

interface FloatingPlusProps {
  onClick: () => void;
  ariaLabel?: string;
}

const FloatingPlus: React.FC<FloatingPlusProps> = ({ onClick, ariaLabel = 'Add' }) => {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="md:hidden fixed bottom-20 right-6 z-50 bg-indigo-600 text-white p-4 rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 active:scale-95"
    >
      <Icons.Plus />
    </button>
  );
};

export default FloatingPlus;
