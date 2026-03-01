import React from "react";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  show: boolean;
  title: string;
  message: string | React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  show,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "确定",
  cancelText = "取消",
  isDanger = false
}) => {
  return (
    <Modal
      show={show}
      title={title}
      onClose={onCancel}
      footer={
        <div className="flex w-full space-x-3">
          <button 
            onClick={onCancel}
            className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all active:scale-95"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className={`flex-1 py-2.5 text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 ${
              isDanger ? "bg-red-600 hover:bg-red-700" : "bg-primary-600 hover:bg-primary-700"
            }`}
          >
            {confirmText}
          </button>
        </div>
      }
    >
      <div className="text-gray-700 leading-relaxed whitespace-pre-wrap py-2">
        {message}
      </div>
    </Modal>
  );
};

