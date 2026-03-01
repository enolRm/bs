import React from "react";
import { Modal } from "./Modal";

interface AlertDialogProps {
  show: boolean;
  title: string;
  message: string | React.ReactNode;
  onClose: () => void;
  confirmText?: string;
  type?: "info" | "error" | "success" | "warning";
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  show,
  title,
  message,
  onClose,
  confirmText = "知道了",
  type = "info"
}) => {
  const getThemeClasses = () => {
    switch (type) {
      case "error": return "bg-red-600 hover:bg-red-700";
      case "success": return "bg-green-600 hover:bg-green-700";
      case "warning": return "bg-amber-600 hover:bg-amber-700";
      default: return "bg-primary-600 hover:bg-primary-700";
    }
  };

  return (
    <Modal
      show={show}
      title={title}
      onClose={onClose}
      footer={
        <button 
          onClick={onClose}
          className={`w-full py-3 text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 ${getThemeClasses()}`}
        >
          {confirmText}
        </button>
      }
    >
      <div className="text-gray-700 leading-relaxed whitespace-pre-wrap py-2">
        {message}
      </div>
    </Modal>
  );
};

