import React, { useEffect, useState } from "react";
import { knowledgeApi, WarningMessage } from "../api";

export const WarningListPage: React.FC = () => {
  const [warnings, setWarnings] = useState<WarningMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWarnings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await knowledgeApi.getWarnings();
      setWarnings(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "加载警告信息失败");
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (id: number) => {
    if (!window.confirm("确认已处理该警告信息吗？")) return;
    try {
      await knowledgeApi.processWarning(id);
      // 更新本地状态，显示已处理
      setWarnings(warnings.map(w => w.id === id ? { ...w, is_processed: 1 } : w));
      // 通知导航栏更新数量
      window.dispatchEvent(new CustomEvent("update-warning-count"));
    } catch (e: any) {
      alert("处理失败: " + (e?.response?.data?.detail || e?.message));
    }
  };

  useEffect(() => {
    loadWarnings();
  }, []);

  return (
    <div>
      <h2>警告消息列表</h2>
      <p style={{ color: "#666" }}>这里记录了 RAG 检索过程中发现的本地数据与区块链数据不一致的情况。</p>
      
      {loading && <p>加载中...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      
      {!loading && !error && warnings.length === 0 && (
        <p>暂无警告信息</p>
      )}

      {warnings.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}>
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5" }}>
              <th style={cellStyle}>ID</th>
              <th style={cellStyle}>数据库ID</th>
              <th style={cellStyle}>链上ID</th>
              <th style={cellStyle}>错误信息</th>
              <th style={cellStyle}>状态</th>
              <th style={cellStyle}>创建时间</th>
              <th style={cellStyle}>操作</th>
            </tr>
          </thead>
          <tbody>
            {warnings.map((w) => (
              <tr key={w.id}>
                <td style={cellStyle}>{w.id}</td>
                <td style={cellStyle}>{w.knowledge_id || "-"}</td>
                <td style={cellStyle}>{w.chain_id || "-"}</td>
                <td style={cellStyle}>{w.error_message}</td>
                <td style={cellStyle}>
                  {w.is_processed === 1 ? (
                    <span style={{ color: "green", fontWeight: "bold" }}>已处理</span>
                  ) : (
                    <span style={{ color: "orange", fontWeight: "bold" }}>待处理</span>
                  )}
                </td>
                <td style={cellStyle}>{new Date(w.created_at).toLocaleString()}</td>
                <td style={cellStyle}>
                  {w.is_processed === 0 && (
                    <button 
                      onClick={() => handleProcess(w.id)} 
                      style={{ 
                        backgroundColor: "#1890ff", 
                        color: "white", 
                        border: "none", 
                        padding: "4px 8px", 
                        borderRadius: "4px",
                        cursor: "pointer" 
                      }}
                    >
                      确认处理
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const cellStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: 8,
  textAlign: "left"
};
