import React from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  maxWidth = 'md'
}) => {
  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center">
      <div className={`bg-white w-full ${maxWidthClasses[maxWidth]} rounded-[1rem] p-6 sm:p-12 shadow-2xl animate-in zoom-in duration-300`}>
        <div className="flex justify-end -mt-6 -mr-6">
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 p-2">✕</button>
        </div>
        <h4 className="text-xl font-bold text-slate-800 mb-8 tracking-tight">{title}</h4>
        {children}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;
