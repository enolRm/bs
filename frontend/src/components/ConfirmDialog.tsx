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
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button 
            onClick={onCancel}
            style={{ 
              flex: 1,
              padding: "10px", 
              background: "#f5f5f5", 
              border: "1px solid #ddd", 
              borderRadius: 4, 
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            style={{ 
              flex: 1,
              padding: "10px", 
              background: isDanger ? "#f44336" : "#1976d2", 
              color: "#fff", 
              border: "none", 
              borderRadius: 4, 
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            {confirmText}
          </button>
        </div>
      }
    >
      <div style={{ fontSize: "16px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
        {message}
      </div>
    </Modal>
  );
};
