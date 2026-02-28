import React, { useState, useEffect } from "react";
import { api, Knowledge } from "../api";

const KNOWLEDGE_SUBMIT_STORAGE_KEY = "knowledge_submit_form";

export const KnowledgeSubmitPage: React.FC = () => {
  // 从 localStorage 加载初始状态
  const savedForm = localStorage.getItem(KNOWLEDGE_SUBMIT_STORAGE_KEY);
  const initialForm = savedForm ? JSON.parse(savedForm) : {};

  const [title, setTitle] = useState(initialForm.title || "");
  const [source, setSource] = useState(initialForm.source || "");
  const [content, setContent] = useState(initialForm.content || "");
  const [voteDuration, setVoteDuration] = useState<number>(initialForm.voteDuration || 60);
  const [voteUnit, setVoteUnit] = useState<string>(initialForm.voteUnit || "s");
  
  const [result, setResult] = useState<Knowledge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 当表单字段变化时，保存到 localStorage
  useEffect(() => {
    localStorage.setItem(
      KNOWLEDGE_SUBMIT_STORAGE_KEY,
      JSON.stringify({ title, source, content, voteDuration, voteUnit })
    );
  }, [title, source, content, voteDuration, voteUnit]);

  const submit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await api.post<Knowledge>("/knowledge/", { 
        title, 
        content, 
        source,
        vote_duration: voteDuration,
        vote_unit: voteUnit
      });
      setResult(resp.data);
      // 提交成功后清除缓存
      localStorage.removeItem(KNOWLEDGE_SUBMIT_STORAGE_KEY);
      setTitle("");
      setSource("");
      setContent("");
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
            placeholder="本地手册"
          />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            投票时长
            <input
              type="number"
              style={{ width: "100%", padding: 8, marginTop: 6 }}
              value={voteDuration}
              onChange={(e) => setVoteDuration(parseInt(e.target.value) || 0)}
              min={1}
            />
          </label>
          <label>
            时长单位
            <select
              style={{ width: "100%", padding: 8, marginTop: 6 }}
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
          disabled={loading || !title || !content || !source}
          style={{ padding: "10px 14px", width: 140 }}
        >
          {loading ? "提交中..." : "提交"}
        </button>

        {error ? <div style={{ color: "crimson" }}>错误：{error}</div> : null}
        {result ? (
          <div style={{ background: "#f6f6f6", padding: 12, borderRadius: 6 }}>
            <div>已提交：ID = {result.id}</div>
            {result.chain_id != null ? (
              <div>链上 ID = {result.chain_id}（可在知识列表页进行链上投票）</div>
            ) : (
              <div style={{ color: "#666" }}>未上链（未配置链或上链失败）</div>
            )}
            <div>状态："待投票"</div>
            <div>哈希：{result.content_hash}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

