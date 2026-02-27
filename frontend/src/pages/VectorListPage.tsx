import React, { useEffect, useState, useRef, useCallback } from "react";
import { api, VectorData } from "../api";

export const VectorListPage: React.FC = () => {
  const [data, setData] = useState<VectorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 列宽状态
  const [widths, setWidths] = useState<number[]>([100, 70, 120, 120, 400]);
  const tableRef = useRef<HTMLTableElement>(null);
  const resizingColumn = useRef<number | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  const loadData = async (currentPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<VectorData>("/vector/", {
        params: { page: currentPage, size: pageSize }
      });
      setData(resp.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "加载向量库失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(page);
  }, [page]);

  // 拖拽调整列宽逻辑
  const onMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    resizingColumn.current = index;
    startX.current = e.pageX;
    startWidth.current = widths[index];
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [widths]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (resizingColumn.current !== null) {
        const diff = e.pageX - startX.current;
        const newWidths = [...widths];
        newWidths[resizingColumn.current] = Math.max(50, startWidth.current + diff);
        setWidths(newWidths);
      }
    };

    const onMouseUp = () => {
      resizingColumn.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [widths]);

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const headerStyle: React.CSSProperties = {
    border: "1px solid #ddd",
    padding: 8,
    position: "relative",
    background: "#f5f5f5",
    textAlign: "left",
    userSelect: "none"
  };

  const resizerStyle: React.CSSProperties = {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "5px",
    cursor: "col-resize",
    zIndex: 1
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>向量列表</h2>
        <div style={{ color: "#666", fontSize: 14 }}>
          共 {data?.total || 0} 条记录
        </div>
      </div>
      
      <p style={{ color: "#666" }}>
        展示向量数据库中的数据（过滤 embeddings 字段）。支持拖拽表头边缘调整列宽。
      </p>

      <div style={{ marginBottom: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={() => loadData(page)} disabled={loading} style={{ padding: "8px 12px" }}>
          {loading ? "刷新中..." : "刷新数据"}
        </button>
      </div>

      {error ? <div style={{ color: "crimson", marginBottom: 12 }}>错误：{error}</div> : null}

      <div style={{ overflowX: "auto" }}>
        <table 
          ref={tableRef}
          style={{ 
            width: "max-content", 
            minWidth: "100%", 
            borderCollapse: "collapse", 
            fontSize: 14,
            tableLayout: "fixed" // 必须使用 fixed 布局才能精确控制列宽
          }}
        >
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              {[
                "向量ID(链上ID)", 
                "数据库ID", 
                "标题", 
                "来源", 
                "文档内容"
              ].map((label, i) => (
                <th key={i} style={{ ...headerStyle, width: widths[i] }}>
                  {label}
                  <div 
                    style={resizerStyle} 
                    onMouseDown={(e) => onMouseDown(i, e)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data && data.ids.length > 0 ? (
              data.ids.map((id, index) => {
                const metadata = data.metadatas[index] || {};
                return (
                  <tr key={id}>
                    <td style={{ border: "1px solid #ddd", padding: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{id}</td>
                    <td style={{ border: "1px solid #ddd", padding: 8, overflow: "hidden", textOverflow: "ellipsis" }}>{metadata.db_id || "-"}</td>
                    <td style={{ border: "1px solid #ddd", padding: 8, overflow: "hidden", textOverflow: "ellipsis" }}>{metadata.title || "-"}</td>
                    <td style={{ border: "1px solid #ddd", padding: 8, overflow: "hidden", textOverflow: "ellipsis" }}>{metadata.source || "-"}</td>
                    <td style={{ border: "1px solid #ddd", padding: 8 }}>
                      <div style={{ maxHeight: 200, overflowY: "auto", wordBreak: "break-all" }}>
                        {data.documents[index]}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} style={{ border: "1px solid #ddd", padding: 16, textAlign: "center", color: "#999" }}>
                  {loading ? "加载中..." : "暂无向量数据"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 分页控制 */}
      {totalPages > 1 && (
        <div style={{ marginTop: 20, display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
          <button 
            disabled={page <= 1 || loading} 
            onClick={() => setPage(p => p - 1)}
            style={{ padding: "6px 12px", cursor: page <= 1 ? "not-allowed" : "pointer" }}
          >
            上一页
          </button>
          <span style={{ fontSize: 14 }}>
            第 {page} / {totalPages} 页
          </span>
          <button 
            disabled={page >= totalPages || loading} 
            onClick={() => setPage(p => p + 1)}
            style={{ padding: "6px 12px", cursor: page >= totalPages ? "not-allowed" : "pointer" }}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
};
