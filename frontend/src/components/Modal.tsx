import React from "react";

interface ModalProps {
  show: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({ 
  show, 
  title, 
  onClose, 
  children, 
  footer,
  maxWidth = "500px" 
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full relative animate-in zoom-in-95 duration-200 overflow-hidden" 
        style={{ maxWidth }} 
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 p-1 rounded-full transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
          {children}
        </div>

        <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100 flex justify-end space-x-3">
          {footer !== undefined ? (
            footer
          ) : (
            <button 
              onClick={onClose}
              className="px-6 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

