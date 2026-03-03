import React, { useEffect, useState } from "react";
import { api, Knowledge, KnowledgeHistoryItem, VoteDetails } from "../api";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";

type PendingAction = "vote_yes" | "vote_no" | null;

export const TracePage: React.FC = () => {
  const [items, setItems] = useState<Knowledge[]>([]);
  const [selected, setSelected] = useState<Knowledge | null>(null);
  const [history, setHistory] = useState<KnowledgeHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSource, setEditSource] = useState("");
  const [voteDuration, setVoteDuration] = useState<number>(60);
  const [voteUnit, setVoteUnit] = useState<string>("s");
  const [saving, setSaving] = useState(false);

  const [pending, setPending] = useState<{ id: number; chainId: string | null; action: PendingAction } | null>(null);
  const [lastResult, setLastResult] = useState<{ message: string; tx_hash?: string } | null>(null);
  const [historyDetail, setHistoryDetail] = useState<KnowledgeHistoryItem | null>(null);
  const [voteDetails, setVoteDetails] = useState<VoteDetails | null>(null);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadList = async () => {
    setLoading(true);
    setError(null);
    setLastResult(null);
    try {
      const resp = await api.get<Knowledge[]>("/knowledge/");
      setItems(resp.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (!selected) {
      setHistory([]);
      return;
    }
    setEditTitle(selected.title);
    setEditContent(selected.content);
    setEditSource(selected.source || "");
    api
      .get<KnowledgeHistoryItem[]>(`/knowledge/${selected.id}/history`)
      .then((r) => setHistory(r.data))
      .catch(() => setHistory([]));
  }, [selected]);

  const vote = async (knowledgeId: number, support: boolean) => {
    setError(null);
    setLastResult(null);
    // 注意：这里为了兼容性，pending 里的 chainId 我们暂时存为 string 或 null，
    // 但 API 调用我们改用 knowledgeId (int)
    setPending({ id: knowledgeId, chainId: selected?.chain_id || null, action: support ? "vote_yes" : "vote_no" });
    try {
      const resp = await api.post<{ tx_hash: string }>(`/verification/${knowledgeId}/vote`, { support });
      setLastResult({ message: support ? "同意投票已上链" : "反对投票已上链", tx_hash: resp.data.tx_hash });
      await loadList();
      // 更新当前选中的 item 状态
      if (selected) {
        const updatedResp = await api.get<Knowledge>(`/knowledge/${selected.id}`);
        setSelected(updatedResp.data);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "链上投票失败");
    } finally {
      setPending(null);
    }
  };

  const isPendingAction = (k: Knowledge, action: PendingAction) =>
    pending?.id === k.id && pending?.action === action;

  const formatDateTime = (dtStr: string | null) => {
    if (!dtStr) return "";
    // 确保时间字符串包含 Z 以便解析为 UTC，除非已经包含了时区信息
    const isoStr = dtStr.includes("Z") || dtStr.includes("+") ? dtStr : dtStr + "Z";
    return new Date(isoStr).toLocaleString();
  };

  const isVoteExpired = (deadline: string | null) => {
    if (!deadline) return false;
    const isoStr = deadline.includes("Z") || deadline.includes("+") ? deadline : deadline + "Z";
    return new Date(isoStr) < new Date();
  };

  const hasChanges = selected && (
    editTitle !== selected.title ||
    editContent !== selected.content ||
    editSource !== (selected.source || "")
  );

  const fetchVoteDetails = async (contentHash: string) => {
    try {
      const resp = await api.get<VoteDetails>(`/verification/votes-by-hash/${contentHash}`);
      setVoteDetails(resp.data);
      setShowVoteModal(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "获取投票详情失败");
    }
  };

  const saveUpdate = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const payload: { 
        title?: string; 
        content?: string; 
        source?: string;
        vote_duration?: number;
        vote_unit?: string;
      } = {};
      if (editTitle !== selected.title) payload.title = editTitle;
      if (editContent !== selected.content) payload.content = editContent;
      if (editSource !== (selected.source || "")) payload.source = editSource;
      
      // 只要内容有变更，就带上投票时长（因为后端逻辑是 hash 变更才触发链上更新）
      if (payload.title || payload.content || payload.source) {
        payload.vote_duration = voteDuration;
        payload.vote_unit = voteUnit;
      }

      if (Object.keys(payload).length === 0) {
        setSaving(false);
        return;
      }
      const resp = await api.patch<Knowledge>(`/knowledge/${selected.id}`, payload);
      setSelected(resp.data);
      setEditTitle(resp.data.title);
      setEditContent(resp.data.content);
      setEditSource(resp.data.source || "");
      const histResp = await api.get<KnowledgeHistoryItem[]>(`/knowledge/${selected.id}/history`);
      setHistory(histResp.data);
      await loadList();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "更新失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!selected) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/knowledge/${selected.id}`);
      setLastResult({ message: "知识已成功删除" });
      setSelected(null);
      // 通知导航栏更新数量
      window.dispatchEvent(new CustomEvent("update-warning-count"));
      await loadList();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-3 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            知识列表
          </h2>
          <p className="text-sm text-gray-500 mt-1">支持知识的详情查看、更新、删除、投票验证与追溯等</p>
        </div>
        <button
          onClick={loadList}
          disabled={loading}
          className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            loading
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-primary-50 text-primary-700 hover:bg-primary-100 active:scale-95"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? "正在同步..." : "刷新同步"}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-[600px]">
        {/* Sidebar List */}
        <div className="w-80 border-r border-gray-100 bg-gray-50/30 overflow-y-auto">
          {items.length === 0 && !loading ? (
            <div className="p-8 text-center text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              暂无存证知识
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {items.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setSelected(k)}
                  className={`w-full text-left p-4 rounded-xl transition-all border ${
                    selected?.id === k.id
                      ? "bg-white border-primary-500 shadow-md ring-1 ring-primary-500/20"
                      : "bg-transparent border-transparent hover:bg-gray-100 text-gray-600"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      k.status === "verified" ? "bg-green-100 text-green-700" :
                      k.status === "rejected" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {k.status === "verified" ? "已通过" : k.status === "rejected" ? "已驳回" : "待投票"}
                    </span>
                    <span className="text-xs text-gray-400 font-mono"># {k.id}</span>
                  </div>
                  <h4 className={`text-sm font-bold truncate ${selected?.id === k.id ? "text-primary-900" : "text-gray-700"}`}>
                    {k.title}
                  </h4>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail Content */}
        <div className="flex-1 overflow-y-auto bg-white">
          {selected ? (
            <div className="p-8 space-y-8">
              {/* Header Info */}
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-gray-900">{selected.title}</h3>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-3 items-center text-sm">
                      <span className="flex items-center text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        {selected.chain_id ? `链上ID : ${selected.chain_id}` : "未在链上注册"}
                      </span>
                      {selected.status === "pending" && selected.voting_deadline && (
                        <span className={`flex items-center px-2 py-1 rounded font-medium ${
                          isVoteExpired(selected.voting_deadline) ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                        }`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          投票截止: {formatDateTime(selected.voting_deadline)}
                          {isVoteExpired(selected.voting_deadline) ? " (已截止)" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="flex items-center text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        知识提交/更新者 : {selected.submitter_address || "系统管理员"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {selected.status === "pending" && !isVoteExpired(selected.voting_deadline) && selected.chain_id != null && (
                    <>
                      <button
                        onClick={() => vote(selected.id, true)}
                        disabled={!!pending}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 shadow-sm active:scale-95 disabled:opacity-50 transition-all"
                      >
                        {isPendingAction(selected, "vote_yes") ? "提交中..." : "同意"}
                      </button>
                      <button
                        onClick={() => vote(selected.id, false)}
                        disabled={!!pending}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 shadow-sm active:scale-95 disabled:opacity-50 transition-all"
                      >
                        {isPendingAction(selected, "vote_no") ? "提交中..." : "反对"}
                      </button>
                    </>
                  )}
                  {(isVoteExpired(selected.voting_deadline) || selected.status !== "pending") && (
                    <button
                      onClick={() => fetchVoteDetails(selected.content_hash)}
                      className="px-4 py-2 bg-primary-100 text-primary-700 rounded-lg text-sm font-bold hover:bg-primary-200 transition-all flex items-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      查看投票详情
                    </button>
                  )}
                </div>
              </div>

              {/* Edit Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">标题</label>
                  <input
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition-all bg-white"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">来源</label>
                  <input
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition-all bg-white"
                    value={editSource}
                    onChange={(e) => setEditSource(e.target.value)}
                    placeholder="例如：网址链接、文档名称..."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">正文内容</label>
                  <textarea
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition-all min-h-[160px] bg-white resize-y"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">投票时长</label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      className="w-24 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition-all bg-white"
                      value={voteDuration}
                      onChange={(e) => setVoteDuration(parseInt(e.target.value) || 0)}
                      min={1}
                    />
                    <select
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition-all bg-white"
                      value={voteUnit}
                      onChange={(e) => setVoteUnit(e.target.value)}
                    >
                      <option value="s">秒 (Seconds)</option>
                      <option value="m">分 (Minutes)</option>
                      <option value="h">时 (Hours)</option>
                      <option value="d">日 (Days)</option>
                    </select>
                  </div>
                </div>
                <div className="md:col-span-2 flex gap-3 pt-2">
                  <button
                    onClick={saveUpdate}
                    disabled={saving || deleting || !editTitle || !editContent || !hasChanges}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                      saving || deleting || !editTitle || !editContent || !hasChanges
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-primary-600 text-white hover:bg-primary-700 shadow-md hover:shadow-lg active:scale-95"
                    }`}
                  >
                    {saving ? "正在同步更新..." : "提交版本更新"}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={saving || deleting}
                    className="px-6 py-3 border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-all active:scale-95"
                  >
                    {deleting ? "删除中..." : "删除"}
                  </button>
                </div>
              </div>

              {/* Metadata & History */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    当前版本指纹 (SHA-256)
                  </h4>
                  <div className="bg-gray-100 p-4 rounded-xl font-mono text-[10px] break-all text-gray-600 border border-gray-200">
                    {selected.content_hash}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    修订历史记录
                  </h4>
                  {history.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">暂无历史修改记录</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {history.map((h, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg hover:border-primary-200 hover:shadow-sm transition-all group">
                          <div 
                            onClick={() => setHistoryDetail(h)}
                            className="flex-1 cursor-pointer"
                          >
                            <p className="text-xs font-bold text-gray-700 group-hover:text-primary-600 transition-colors">
                              {h.created_at ? formatDateTime(h.created_at) : `版本 #${history.length - i}`}
                            </p>
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">{h.content_hash.substring(0, 12)}...</p>
                          </div>
                          <button
                            onClick={() => fetchVoteDetails(h.content_hash)}
                            className="text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded hover:bg-primary-100 transition-colors"
                          >
                            投票详情
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-12 text-center">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
              <p className="max-w-xs text-sm">请从左侧列表选择一条知识以查看详细信息、<br></br>参与投票或提交修订更新...</p>
            </div>
          )}
        </div>
      </div>

      {showVoteModal && voteDetails && (
        <Modal
          show={showVoteModal}
          title="存证投票详情"
          onClose={() => setShowVoteModal(false)}
          maxWidth="600px"
        >
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">内容指纹 (Hash)</p>
              <p className="text-xs font-mono text-gray-600 break-all">{voteDetails.content_hash}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Agree Column */}
              <div className="flex flex-col space-y-4">
                <div className="bg-green-50 p-6 rounded-2xl border border-green-100 text-center">
                  <div className="text-green-600 text-xs font-bold uppercase mb-2">同意</div>
                  <div className="text-4xl font-black text-green-700">{voteDetails.agree_count}</div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-green-800 flex items-center">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
                    赞成票发起者
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                    {voteDetails.agree_voters.length > 0 ? (
                      voteDetails.agree_voters.map((v, i) => (
                        <div key={i} className="text-[10px] font-mono bg-white border border-green-200 text-green-700 px-2 py-1 rounded shadow-sm break-all">
                          {v}
                        </div>
                      ))
                    ) : <p className="text-xs text-gray-400 italic px-4">暂无投票记录</p>}
                  </div>
                </div>
              </div>

              {/* Reject Column */}
              <div className="flex flex-col space-y-4">
                <div className="bg-red-50 p-6 rounded-2xl border border-red-100 text-center">
                  <div className="text-red-600 text-xs font-bold uppercase mb-2">拒绝</div>
                  <div className="text-4xl font-black text-red-700">{voteDetails.reject_count}</div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-red-800 flex items-center">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></span>
                    反对票发起者
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                    {voteDetails.reject_voters.length > 0 ? (
                      voteDetails.reject_voters.map((v, i) => (
                        <div key={i} className="text-[10px] font-mono bg-white border border-red-200 text-red-700 px-2 py-1 rounded shadow-sm break-all">
                          {v}
                        </div>
                      ))
                    ) : <p className="text-xs text-gray-400 italic px-4">暂无投票记录</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {historyDetail && (
        <Modal
          show={!!historyDetail}
          title="版本追溯详情"
          onClose={() => setHistoryDetail(null)}
          maxWidth="800px"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">链上登记 ID</p>
                <p className="font-bold text-gray-900">{historyDetail.chain_id || "未上链"}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">版本状态</p>
                <p className={`font-bold ${
                  historyDetail.status === "verified" ? "text-green-600" : 
                  historyDetail.status === "rejected" ? "text-red-600" : "text-blue-600"
                }`}>
                  {historyDetail.status === "pending" ? "待投票" : historyDetail.status === "verified" 
                    ? "已验证通过" : historyDetail.status === "rejected" ? "已驳回" : (historyDetail.status || "未知")}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase">标题</p>
              <p className="text-lg font-bold text-gray-900">{historyDetail.title || "无标题"}</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase">数据源</p>
              <p className="text-sm text-gray-700">{historyDetail.source || "未注明"}</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase">版本正文</p>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                {historyDetail.content || "内容为空"}
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">内容哈希 (SHA-256)</p>
              <p className="text-xs font-mono text-gray-600 break-all">{historyDetail.content_hash}</p>
            </div>

            <div className="flex justify-between items-center text-[10px] text-gray-400 font-medium pt-4 border-t border-gray-100">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                知识提交/更新者: {historyDetail.operator || "系统管理员"}
              </div>
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                存证时间: {formatDateTime(historyDetail.created_at)}
              </div>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        show={showDeleteConfirm}
        title="确认要删除此知识吗？"
        message={`删除知识将会：\n1. 从本地数据库移除\n2. 从 RAG 向量库中注销索引\n3. 使区块链上的该版本存证失效。\n\n此操作不可撤销，请谨慎操作。`}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        isDanger={true}
      />
    </div>
  );
};

