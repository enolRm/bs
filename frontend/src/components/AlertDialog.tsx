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
  const getColor = () => {
    switch (type) {
      case "error": return "#f44336";
      case "success": return "#4caf50";
      case "warning": return "#ff9800";
      default: return "#1976d2";
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
          style={{ 
            width: "100%", 
            marginTop: 12, 
            padding: "10px", 
            background: getColor(), 
            color: "#fff", 
            border: "none", 
            borderRadius: 4, 
            cursor: "pointer",
            fontSize: "14px"
          }}
        >
          {confirmText}
        </button>
      }
    >
      <div style={{ fontSize: "16px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
        {message}
      </div>
    </Modal>
  );
};
