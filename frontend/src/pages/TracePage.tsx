import React, { useEffect, useState } from "react";
import { api, Knowledge, KnowledgeHistoryItem, VoteDetails } from "../api";

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

  return (
    <div>
      <h2>知识列表</h2>
      <p style={{ color: "#666" }}>
        知识列表，可点击查看知识详情与历史记录，支持提交更新与投票验证。
      </p>

      <div style={{ marginBottom: 12 }}>
        <button onClick={loadList} disabled={loading} style={{ padding: "8px 12px" }}>
          {loading ? "刷新中..." : "刷新列表"}
        </button>
      </div>

      {error ? <div style={{ color: "crimson", marginBottom: 12 }}>错误：{error}</div> : null}
      {lastResult ? (
        <div style={{ marginBottom: 12, padding: 10, background: "#e8f5e9", borderRadius: 6 }}>
          {lastResult.message}
          {lastResult.tx_hash ? <div style={{ marginTop: 4, fontSize: 12, wordBreak: "break-all" }}>tx: {lastResult.tx_hash}</div> : null}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 12, background: "#fafafa" }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>知识列表</div>
          <div style={{ display: "grid", gap: 6 }}>
            {items.map((k) => (
              <button
                key={k.id}
                onClick={() => setSelected(k)}
                style={{
                  padding: "8px 10px",
                  textAlign: "left",
                  border: selected?.id === k.id ? "2px solid #1976d2" : "1px solid #ddd",
                  borderRadius: 6,
                  background: selected?.id === k.id ? "#e3f2fd" : "#fff",
                  cursor: "pointer",
                }}
              >
                #{k.id} {k.title}
              </button>
            ))}
            {items.length === 0 ? <div style={{ color: "#666" }}>暂无数据</div> : null}
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 12, background: "#fff" }}>
          {selected ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>
                    ID #{selected.id} | 
                    {selected.chain_id ? ` 链上ID ${selected.chain_id}` : "未上链"}
                  </div>
                  <div style={{ color: "#666", marginTop: 4 }}>
                  状态：{selected.status === "pending" ? "待投票" : selected.status === "verified" 
                    ? "已通过" : selected.status === "rejected" ? "已拒绝" : selected.status}
                  {selected.status === "pending" && selected.voting_deadline && (
                    <span style={{ marginLeft: 12, fontSize: 13, color: isVoteExpired(selected.voting_deadline) ? "#f44336" : "#1976d2" }}>
                      投票截止时间：{formatDateTime(selected.voting_deadline)} 
                      {isVoteExpired(selected.voting_deadline) ? " (已截止)" : ""}
                    </span>
                  )}
                  </div>
                </div>
                {selected.status === "pending" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => vote(selected.id, true)}
                      disabled={!!pending || isVoteExpired(selected.voting_deadline) || selected.chain_id == null}
                      style={{ 
                        padding: "6px 12px", 
                        background: (isVoteExpired(selected.voting_deadline) || selected.chain_id == null) ? "#bdbdbd" : "#4caf50", 
                        color: "#fff", 
                        border: "none", 
                        borderRadius: 4, 
                        cursor: (isVoteExpired(selected.voting_deadline) || selected.chain_id == null) ? "not-allowed" : "pointer" 
                      }}
                    >
                      {isPendingAction(selected, "vote_yes") ? "提交中..." : "同意"}
                    </button>
                    <button
                      onClick={() => vote(selected.id, false)}
                      disabled={!!pending || isVoteExpired(selected.voting_deadline) || selected.chain_id == null}
                      style={{ 
                        padding: "6px 12px", 
                        background: (isVoteExpired(selected.voting_deadline) || selected.chain_id == null) ? "#bdbdbd" : "#f44336", 
                        color: "#fff", 
                        border: "none", 
                        borderRadius: 4, 
                        cursor: (isVoteExpired(selected.voting_deadline) || selected.chain_id == null) ? "not-allowed" : "pointer" 
                      }}
                    >
                      {isPendingAction(selected, "vote_no") ? "提交中..." : "反对"}
                    </button>
                  </div>
                )}
                {(isVoteExpired(selected.voting_deadline) || selected.status !== "pending") && (
                  <button
                    onClick={() => fetchVoteDetails(selected.content_hash)}
                    style={{
                      padding: "6px 12px",
                      background: "#2196f3",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer"
                    }}
                  >
                    查看投票详情
                  </button>
                )}
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", marginBottom: 4 }}>
                  标题
                  <input
                    style={{ width: "100%", padding: 8, marginTop: 4 }}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </label>
                <label style={{ display: "block", marginTop: 10 }}>
                  来源
                  <input
                    style={{ width: "100%", padding: 6, marginTop: 4 }}
                    value={editSource}
                    onChange={(e) => setEditSource(e.target.value)}
                  />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                  <label>
                    投票时长
                    <input
                      type="number"
                      style={{ width: "100%", padding: 6, marginTop: 4 }}
                      value={voteDuration}
                      onChange={(e) => setVoteDuration(parseInt(e.target.value) || 0)}
                      min={1}
                    />
                  </label>
                  <label>
                    时长单位
                    <select
                      style={{ width: "100%", padding: 6, marginTop: 4 }}
                      value={voteUnit}
                      onChange={(e) => setVoteUnit(e.target.value)}
                    >
                      <option value="s">秒 (Seconds)</option>
                      <option value="m">分 (Minutes)</option>
                      <option value="h">时 (Hours)</option>
                      <option value="d">日 (Days)</option>
                    </select>
                  </label>
                </div>
                <label style={{ display: "block", marginTop: 10 }}>
                  正文
                  <textarea
                    style={{ width: "100%", padding: 8, marginTop: 4, minHeight: 120 }}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
                </label>
                <button onClick={saveUpdate} disabled={saving} style={{ padding: "8px 12px" }}>
                  {saving ? "保存中..." : "保存更新"}
                </button>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>当前哈希</div>
                <div style={{ fontSize: 12, wordBreak: "break-all", color: "#555" }}>
                  {selected.content_hash}
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>历史记录</div>
                {history.length === 0 ? (
                  <div style={{ color: "#666" }}>暂无历史</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {history.map((h, i) => (
                      <li 
                        key={i} 
                        style={{ marginBottom: 8, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                      >
                        <span 
                          onClick={() => setHistoryDetail(h)}
                          style={{ color: "#1976d2", cursor: "pointer", textDecoration: "underline", wordBreak: "break-all", flex: 1 }}
                        >
                          {h.created_at ? formatDateTime(h.created_at) : `历史记录 #${i+1}`} ({h.content_hash.substring(0, 8)}...)
                        </span>
                        <button
                          onClick={() => fetchVoteDetails(h.content_hash)}
                          style={{
                            marginLeft: 8,
                            padding: "2px 8px",
                            fontSize: 11,
                            background: "#f0f0f0",
                            border: "1px solid #ccc",
                            borderRadius: 4,
                            cursor: "pointer"
                          }}
                        >
                          投票详情
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div style={{ color: "#666" }}>请从左侧选择一条知识</div>
          )}
        </div>
      </div>

      {showVoteModal && voteDetails && (
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
        }}>
          <div style={{
            background: "#fff",
            padding: 24,
            borderRadius: 8,
            width: "500px",
            maxHeight: "80vh",
            overflowY: "auto",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>投票详情</h3>
              <button onClick={() => setShowVoteModal(false)} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer" }}>&times;</button>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#666", wordBreak: "break-all" }}>内容哈希：{voteDetails.content_hash}</div>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div style={{ background: "#e8f5e9", padding: 12, borderRadius: 6, textAlign: "center" }}>
                <div style={{ color: "#2e7d32", fontSize: 14 }}>同意票数</div>
                <div style={{ fontSize: 24, fontWeight: "bold", color: "#2e7d32" }}>{voteDetails.agree_count}</div>
              </div>
              <div style={{ background: "#ffebee", padding: 12, borderRadius: 6, textAlign: "center" }}>
                <div style={{ color: "#c62828", fontSize: 14 }}>反对票数</div>
                <div style={{ fontSize: 24, fontWeight: "bold", color: "#c62828" }}>{voteDetails.reject_count}</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: "#2e7d32" }}>同意投票者列表：</div>
              {voteDetails.agree_voters.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
                  {voteDetails.agree_voters.map((v, i) => <li key={i} style={{ marginBottom: 4, wordBreak: "break-all" }}>{v}</li>)}
                </ul>
              ) : <div style={{ color: "#999", fontSize: 14 }}>暂无</div>}
            </div>

            <div>
              <div style={{ fontWeight: 600, marginBottom: 8, color: "#c62828" }}>反对投票者列表：</div>
              {voteDetails.reject_voters.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
                  {voteDetails.reject_voters.map((v, i) => <li key={i} style={{ marginBottom: 4, wordBreak: "break-all" }}>{v}</li>)}
                </ul>
              ) : <div style={{ color: "#999", fontSize: 14 }}>暂无</div>}
            </div>

            <button 
              onClick={() => setShowVoteModal(false)}
              style={{ width: "100%", marginTop: 24, padding: "10px", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer" }}
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {historyDetail && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000
        }} onClick={() => setHistoryDetail(null)}>
          <div style={{
            backgroundColor: "#fff",
            padding: 24,
            borderRadius: 8,
            maxWidth: "80%",
            maxHeight: "80%",
            overflowY: "auto",
            position: "relative",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid #eee", paddingBottom: 12 }}>
              <h3 style={{ margin: 0 }}>历史版本详情</h3>
              <button 
                onClick={() => setHistoryDetail(null)}
                style={{ border: "none", background: "none", fontSize: 24, cursor: "pointer", color: "#999" }}
              >&times;</button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "12px 16px", fontSize: 14 }}>
              <div style={{ fontWeight: 600, color: "#666" }}>链上 ID</div>
              <div>{historyDetail.chain_id || "未上链"}</div>

              <div style={{ fontWeight: 600, color: "#666" }}>标题</div>
              <div>{historyDetail.title || "无"}</div>
              
              <div style={{ fontWeight: 600, color: "#666" }}>来源</div>
              <div>{historyDetail.source || "无"}</div>
              
              <div style={{ fontWeight: 600, color: "#666" }}>正文</div>
              <div style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 12, borderRadius: 4, maxHeight: 300, overflowY: "auto" }}>
                {historyDetail.content || "无"}
              </div>
              
              <div style={{ fontWeight: 600, color: "#666" }}>内容哈希</div>
              <div style={{ wordBreak: "break-all", fontSize: 12, color: "#555" }}>{historyDetail.content_hash}</div>
              
              <div style={{ fontWeight: 600, color: "#666" }}>状态</div>
              <div>
                {historyDetail.status === "pending" ? "待投票" : historyDetail.status === "verified" 
                  ? "已通过" : historyDetail.status === "rejected" ? "已拒绝" : (historyDetail.status || "未知")}
              </div>

              <div style={{ fontWeight: 600, color: "#666" }}>操作者</div>
              <div>{historyDetail.operator || "无"}</div>
              
              <div style={{ fontWeight: 600, color: "#666" }}>保存时间</div>
              <div>{formatDateTime(historyDetail.created_at)}</div>
            </div>
            
            <div style={{ marginTop: 24, textAlign: "right" }}>
              <button 
                onClick={() => setHistoryDetail(null)}
                style={{ padding: "8px 24px", cursor: "pointer" }}
              >关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
