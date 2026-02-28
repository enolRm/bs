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
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000
    }} onClick={onClose}>
      <div style={{
        background: "#fff",
        padding: 24,
        borderRadius: 8,
        width: maxWidth,
        maxWidth: "90%",
        maxHeight: "85vh",
        overflowY: "auto",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        position: "relative"
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button 
            onClick={onClose} 
            style={{ border: "none", background: "none", fontSize: 24, cursor: "pointer", color: "#999" }}
          >&times;</button>
        </div>
        
        <div style={{ marginBottom: 20 }}>
          {children}
        </div>

        {footer !== undefined ? (
          footer
        ) : (
          <button 
            onClick={onClose}
            style={{ 
              width: "100%", 
              marginTop: 12, 
              padding: "10px", 
              background: "#f5f5f5", 
              border: "1px solid #ddd", 
              borderRadius: 4, 
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            关闭
          </button>
        )}
      </div>
    </div>
  );
};
