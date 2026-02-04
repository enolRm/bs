import React, { useEffect, useState } from "react";
import { api, Knowledge } from "../api";

type PendingAction = "vote_yes" | "vote_no" | "finalize" | "sync" | null;

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

  const approve = async (id: number) => {
    setError(null);
    setLastResult(null);
    try {
      await api.post(`/verification/${id}/approve`);
      setLastResult({ message: "已通过并写入向量库" });
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "审核失败");
    }
  };

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

  const finalize = async (chainId: number) => {
    setError(null);
    setLastResult(null);
    setPending({ id: 0, chainId, action: "finalize" });
    try {
      const resp = await api.post<{ tx_hash: string }>(`/verification/${chainId}/finalize`);
      setLastResult({ message: "终局判定已上链", tx_hash: resp.data.tx_hash });
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "终局判定失败");
    } finally {
      setPending(null);
    }
  };

  const syncStatus = async (dbId: number) => {
    setError(null);
    setLastResult(null);
    setPending({ id: dbId, chainId: null, action: "sync" });
    try {
      await api.post(`/verification/${dbId}/sync-status`);
      setLastResult({ message: "已从链上同步状态到本地" });
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "同步状态失败");
    } finally {
      setPending(null);
    }
  };

  const isPending = (k: Knowledge, action: PendingAction) =>
    pending?.chainId === k.chain_id && pending?.action === action ||
    (action === "sync" && pending?.id === k.id && pending?.action === "sync");

  return (
    <div>
      <h2>知识验证</h2>
      <p style={{ color: "#666" }}>
        简化通过：点击「通过并入库」直接置为 verified 并写入向量库。链上流程：需先上链（链上 ID 存在）后可「同意/反对」投票，投票期结束后「终局判定」，再「同步链上状态」更新本地并入库。
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
              <button
                onClick={() => approve(k.id)}
                disabled={k.status === "verified"}
                style={{ padding: "8px 12px" }}
              >
                {k.status === "verified" ? "已通过" : "通过并入库"}
              </button>
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
                  <button
                    onClick={() => finalize(k.chain_id!)}
                    disabled={k.status !== "pending" || !!pending}
                    style={{ padding: "8px 12px" }}
                    title="投票期结束后可终局判定"
                  >
                    {isPending(k, "finalize") ? "提交中..." : "终局判定"}
                  </button>
                </>
              ) : null}
              {k.chain_id != null ? (
                <button
                  onClick={() => syncStatus(k.id)}
                  disabled={!!pending}
                  style={{ padding: "8px 12px" }}
                  title="从链上读取状态并更新本地、通过则入库"
                >
                  {isPending(k, "sync") ? "同步中..." : "同步链上状态"}
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {items.length === 0 ? <div style={{ color: "#666" }}>暂无数据</div> : null}
      </div>
    </div>
  );
};

