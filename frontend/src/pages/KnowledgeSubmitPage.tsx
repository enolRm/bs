import React, { useState } from "react";
import { api, Knowledge } from "../api";

export const KnowledgeSubmitPage: React.FC = () => {
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("本地手册");
  const [content, setContent] = useState("");
  const [result, setResult] = useState<Knowledge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await api.post<Knowledge>("/knowledge/", { title, content, source });
      setResult(resp.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "提交失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>知识提交</h2>
      <div style={{ display: "grid", gap: 12, maxWidth: 800 }}>
        <label>
          标题
          <input
            style={{ width: "100%", padding: 8, marginTop: 6 }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：系统使用手册 - 知识提交指南"
          />
        </label>
        <label>
          来源
          <input
            style={{ width: "100%", padding: 8, marginTop: 6 }}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </label>
        <label>
          正文
          <textarea
            style={{ width: "100%", padding: 8, marginTop: 6, minHeight: 160 }}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="粘贴使用手册内容..."
          />
        </label>

        <button
          onClick={submit}
          disabled={loading || !title || !content}
          style={{ padding: "10px 14px", width: 140 }}
        >
          {loading ? "提交中..." : "提交"}
        </button>

        {error ? <div style={{ color: "crimson" }}>错误：{error}</div> : null}
        {result ? (
          <div style={{ background: "#f6f6f6", padding: 12, borderRadius: 6 }}>
            <div>已提交：ID = {result.id}</div>
            {result.chain_id != null ? (
              <div>链上 ID = {result.chain_id}（可在验证页进行链上投票）</div>
            ) : (
              <div style={{ color: "#666" }}>未上链（未配置链或上链失败，仅本地保存）</div>
            )}
            <div>状态：{result.status}</div>
            <div>哈希：{result.content_hash}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

