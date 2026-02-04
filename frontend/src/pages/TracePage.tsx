import React, { useEffect, useState } from "react";
import { api, Knowledge, KnowledgeHistoryItem } from "../api";

export const TracePage: React.FC = () => {
  const [items, setItems] = useState<Knowledge[]>([]);
  const [selected, setSelected] = useState<Knowledge | null>(null);
  const [history, setHistory] = useState<KnowledgeHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSource, setEditSource] = useState("");
  const [saving, setSaving] = useState(false);

  const loadList = async () => {
    setLoading(true);
    setError(null);
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

  const saveUpdate = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const payload: { title?: string; content?: string; source?: string } = {};
      if (editTitle !== selected.title) payload.title = editTitle;
      if (editContent !== selected.content) payload.content = editContent;
      if (editSource !== (selected.source || "")) payload.source = editSource;
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
      <h2>知识追溯与更新</h2>
      <p style={{ color: "#666" }}>
        选择一条知识可查看详情与历史哈希记录；编辑后保存会写入更新历史（当前内容哈希入历史再更新）。
      </p>

      <div style={{ marginBottom: 12 }}>
        <button onClick={loadList} disabled={loading} style={{ padding: "8px 12px" }}>
          {loading ? "刷新中..." : "刷新列表"}
        </button>
      </div>

      {error ? <div style={{ color: "crimson", marginBottom: 12 }}>错误：{error}</div> : null}

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
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                详情 #{selected.id} | 状态：{selected.status}
                {selected.chain_id != null ? ` | 链上 ID：${selected.chain_id}` : ""}
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
                <label style={{ display: "block", marginBottom: 4 }}>
                  来源
                  <input
                    style={{ width: "100%", padding: 8, marginTop: 4 }}
                    value={editSource}
                    onChange={(e) => setEditSource(e.target.value)}
                  />
                </label>
                <label style={{ display: "block", marginBottom: 4 }}>
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
                <div style={{ fontWeight: 600, marginBottom: 6 }}>历史记录（更新前的内容哈希）</div>
                {history.length === 0 ? (
                  <div style={{ color: "#666" }}>暂无历史</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {history.map((h, i) => (
                      <li key={i} style={{ marginBottom: 4, fontSize: 12, wordBreak: "break-all" }}>
                        {h.content_hash} @ {h.created_at}
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
    </div>
  );
};
