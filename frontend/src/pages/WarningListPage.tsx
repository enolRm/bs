import React, { useEffect, useState } from "react";
import { knowledgeApi, WarningMessage } from "../api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { AlertDialog } from "../components/AlertDialog";

export const WarningListPage: React.FC = () => {
  const [warnings, setWarnings] = useState<WarningMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingWarningId, setPendingWarningId] = useState<number | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ show: boolean; title: string; message: string; type: "error" | "success" }>({
    show: false,
    title: "",
    message: "",
    type: "success"
  });

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

  const handleProcess = (id: number) => {
    setPendingWarningId(id);
    setShowConfirm(true);
  };

  const confirmProcess = async () => {
    if (pendingWarningId === null) return;
    const id = pendingWarningId;
    setShowConfirm(false);
    setPendingWarningId(null);
    try {
      await knowledgeApi.processWarning(id);
      // 更新本地状态，显示已处理
      setWarnings(warnings.map(w => w.id === id ? { ...w, is_processed: 1 } : w));
      // 通知导航栏更新数量
      window.dispatchEvent(new CustomEvent("update-warning-count"));
      setAlertConfig({
        show: true,
        title: "处理成功",
        message: "警告信息已标记为已处理",
        type: "success"
      });
    } catch (e: any) {
      setAlertConfig({
        show: true,
        title: "处理失败",
        message: e?.response?.data?.detail || e?.message || "未知错误",
        type: "error"
      });
    }
  };

  useEffect(() => {
    loadWarnings();
  }, []);

  return (
    <div className="p-6 md:p-8 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            系统异常警告
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            监控 RAG 检索过程中发现的本地数据库与区块链存证数据的不一致问题。
          </p>
        </div>
        <button
          onClick={loadWarnings}
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
          {loading ? "正在同步..." : "刷新列表"}
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-center text-red-700 font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          加载失败：{error}
        </div>
      )}

      <div className="flex-1 overflow-hidden bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="min-w-full divide-y divide-gray-100 table-fixed">
            <thead className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th style={{ width: "80px" }} className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">警告 ID</th>
                <th style={{ width: "100px" }} className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">数据库 ID</th>
                <th style={{ width: "180px" }} className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">区块链 ID</th>
                <th style={{ width: "auto" }} className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">异常详情描述</th>
                <th style={{ width: "130px" }} className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">处理状态</th>
                <th style={{ width: "180px" }} className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">发生时间</th>
                <th style={{ width: "130px" }} className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">操作控制</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {warnings.length > 0 ? (
                warnings.map((w) => (
                  <tr key={w.id} className={`hover:bg-gray-50/50 transition-colors ${w.is_processed === 0 ? "bg-amber-50/20" : ""}`}>
                    <td className="px-6 py-4 text-xs font-mono text-gray-400">#{w.id}</td>
                    <td className="px-6 py-4 text-xs text-gray-600">
                      {w.knowledge_id || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-600 truncate" title={w.chain_id || ""}>
                      {w.chain_id || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 leading-relaxed">
                      <div className="flex items-start">
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 mr-2 flex-shrink-0 ${w.is_processed === 1 ? "bg-gray-300" : "bg-red-500 animate-pulse"}`}></span>
                        <div className="break-words w-full whitespace-pre-wrap">
                          {w.error_message}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {w.is_processed === 1 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                          已处理
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                          待处理异常
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(w.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-left whitespace-nowrap">
                      {w.is_processed === 0 ? (
                        <button
                          onClick={() => handleProcess(w.id)}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-bold rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all active:scale-95"
                        >
                          标记为已处理
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300 italic">无需操作</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p>{loading ? "正在同步监控中心数据..." : "系统状态正常，暂无异常警告"}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        show={showConfirm}
        title="确认已处理此警告吗？"
        message="这意味着您已经人工核实了该不一致情况，或者已经手动修正了相关数据。此操作不可逆。"
        onConfirm={confirmProcess}
        onCancel={() => setShowConfirm(false)}
      />

      <AlertDialog
        show={alertConfig.show}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, show: false })}
      />
    </div>
  );
};

