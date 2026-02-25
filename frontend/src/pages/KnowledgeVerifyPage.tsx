import React, { useEffect, useState } from "react";
import { api, Knowledge } from "../api";

type PendingAction = "vote_yes" | "vote_no" | null;

export const KnowledgeVerifyPage: React.FC = () => {
  const [items, setItems] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: number; chainId: number | null; action: PendingAction } | null>(null);
  const [lastResult, setLastResult] = useState<{ message: string; tx_hash?: string } | null>(null);

  const refresh = async () => {
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
    refresh();
  }, []);

  const vote = async (chainId: number, support: boolean) => {
    setError(null);
    setLastResult(null);
    setPending({ id: 0, chainId, action: support ? "vote_yes" : "vote_no" });
    try {
      const resp = await api.post<{ tx_hash: string }>(`/verification/${chainId}/vote`, { support });
      setLastResult({ message: support ? "同意投票已上链" : "反对投票已上链", tx_hash: resp.data.tx_hash });
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "链上投票失败");
    } finally {
      setPending(null);
    }
  };

  const isPending = (k: Knowledge, action: PendingAction) =>
    pending?.chainId === k.chain_id && pending?.action === action;

  return (
    <div>
      <h2>知识验证</h2>
      <p style={{ color: "#666" }}>
        投票「同意/反对」。
      </p>

      <div style={{ marginBottom: 12 }}>
        <button onClick={refresh} disabled={loading} style={{ padding: "8px 12px" }}>
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

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((k) => (
          <div
            key={k.id}
            style={{ border: "1px solid #ddd", borderRadius: 6, padding: 12, background: "#fff" }}
          >
            <div style={{ fontWeight: 600 }}>
              #{k.id} {k.title}
            </div>
            <div style={{ color: "#666", marginTop: 4 }}>
              状态：{k.status} | 来源：{k.source || "-"}
              {k.chain_id != null ? ` | 链上 ID：${k.chain_id}` : " | 未上链"}
            </div>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {k.chain_id != null ? (
                <>
                  <button
                    onClick={() => vote(k.chain_id!, true)}
                    disabled={k.status !== "pending" || !!pending}
                    style={{ padding: "8px 12px" }}
                  >
                    {isPending(k, "vote_yes") ? "提交中..." : "同意"}
                  </button>
                  <button
                    onClick={() => vote(k.chain_id!, false)}
                    disabled={k.status !== "pending" || !!pending}
                    style={{ padding: "8px 12px" }}
                  >
                    {isPending(k, "vote_no") ? "提交中..." : "反对"}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ))}
        {items.length === 0 ? <div style={{ color: "#666" }}>暂无数据</div> : null}
      </div>
    </div>
  );
};

