import React, { useEffect } from 'react';
import { Icons } from '../../constants';

interface ToastProps {
  message: string;
  type: 'success' | 'info' | 'error';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-indigo-600';

  return (
    <div className={`${bgColor} text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-full duration-300 pointer-events-auto border border-white/10`}>
      <div className="flex-1 font-bold text-sm tracking-tight">{message}</div>
      <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
        <Icons.X />
      </button>
    </div>
  );
};

export default Toast;
