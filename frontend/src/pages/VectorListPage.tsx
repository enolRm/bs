import React, { useEffect, useState, useRef, useCallback } from "react";
import { api, VectorData } from "../api";

export const VectorListPage: React.FC = () => {
  const [data, setData] = useState<VectorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 列宽状态
  const [widths, setWidths] = useState<number[]>([80, 80, 120, 120, 400]);
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
    <div className="p-6 md:p-8 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-3 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            向量库检索
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            展示 ChromaDB 向量数据库中的索引数据
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="bg-primary-50 px-3 py-1.5 rounded-lg border border-primary-100">
            <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">总索引量: </span>
            <span className="text-sm font-black text-primary-900 ml-1">{data?.total || 0}</span>
          </div>
          <button
            onClick={() => loadData(page)}
            disabled={loading}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              loading
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 shadow-sm"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? "正在加载..." : "刷新数据"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-center text-red-700 font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          错误：{error}
        </div>
      )}

      <div className="flex-1 overflow-hidden bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col">
        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
          <table
            ref={tableRef}
            className="min-w-full divide-y divide-gray-100 table-fixed"
          >
            <thead className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                {[
                  "向量ID(链上ID)",
                  "本地数据库 ID",
                  "知识标题",
                  "数据来源",
                  "文档原始内容"
                ].map((label, i) => (
                  <th
                    key={i}
                    className="relative px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest border-r border-gray-100 last:border-r-0 select-none group"
                    style={{ width: widths[i] }}
                  >
                    {label}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group-hover:bg-primary-300 transition-colors z-20"
                      onMouseDown={(e) => onMouseDown(i, e)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data && data.ids.length > 0 ? (
                data.ids.map((id, index) => {
                  const metadata = data.metadatas[index] || {};
                  return (
                    <tr key={id} className="hover:bg-primary-50/30 transition-colors group">
                      <td className="px-6 py-4 text-xs font-mono text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis border-r border-gray-50 last:border-r-0">
                        {id}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600 overflow-hidden text-ellipsis border-r border-gray-50 last:border-r-0">
                        {metadata.db_id || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900 overflow-hidden text-ellipsis border-r border-gray-50 last:border-r-0">
                        {metadata.title || "-"}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 overflow-hidden text-ellipsis border-r border-gray-50 last:border-r-0">
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                          {metadata.source || "系统内置"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 leading-relaxed min-w-[300px]">
                        <div className="max-h-32 overflow-y-auto pr-2 custom-scrollbar text-xs bg-gray-50 p-3 rounded-lg border border-gray-100 group-hover:bg-white transition-colors">
                          {data.documents[index]}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                      </svg>
                      <p>{loading ? "正在同步数据库状态..." : "向量库暂无检索记录"}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-center space-x-4">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
              className={`p-2 rounded-lg transition-all ${
                page <= 1 || loading
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-600 hover:bg-white hover:shadow-sm active:scale-90"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="text-sm font-medium text-gray-700 bg-white px-4 py-1.5 rounded-full border border-gray-200 shadow-sm">
              第 <span className="text-primary-600 font-bold">{page}</span> / {totalPages} 页
            </div>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className={`p-2 rounded-lg transition-all ${
                page >= totalPages || loading
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-600 hover:bg-white hover:shadow-sm active:scale-90"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

