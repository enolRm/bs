import React, { useState } from "react";
import { api } from "../api";

export const QAPage: React.FC = () => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [contexts, setContexts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    setLoading(true);
    setError(null);
    setAnswer(null);
    setContexts([]);
    try {
      const resp = await api.post("/qa/", { question });
      setAnswer(resp.data.answer);
      setContexts(resp.data.contexts || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "请求失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>智能问答</h2>
      <div style={{ display: "grid", gap: 12, maxWidth: 900 }}>
        <label>
          你的问题
          <textarea
            style={{ width: "100%", padding: 8, marginTop: 6, minHeight: 90 }}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例如：如何提交知识？投票规则是什么？"
          />
        </label>
        <button onClick={ask} disabled={loading || !question} style={{ padding: "10px 14px", width: 120 }}>
          {loading ? "提问中..." : "提问"}
        </button>

        {error ? <div style={{ color: "crimson" }}>错误：{error}</div> : null}
        {answer ? (
          <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>回答</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{answer}</div>
          </div>
        ) : null}

        {contexts.length ? (
          <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>引用的知识</div>
            <div style={{ display: "grid", gap: 8 }}>
              {contexts.map((c) => (
                <div key={c.id} style={{ background: "#f7f7f7", padding: 10, borderRadius: 6 }}>
                  <div style={{ fontWeight: 600 }}>
                    #{c.id}  标题：{c.title}
                  </div>
                  <div style={{ color: "#666" }}>来源：{c.source || "-"}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

