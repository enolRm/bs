import React, { useState, useEffect } from "react";
import { api } from "../api";

const QA_QUESTION_STORAGE_KEY = "qa_question";
const QA_ANSWER_STORAGE_KEY = "qa_answer";
const QA_CONTEXTS_STORAGE_KEY = "qa_contexts";

export const QAPage: React.FC = () => {
  const [question, setQuestion] = useState(() => {
    return localStorage.getItem(QA_QUESTION_STORAGE_KEY) || "";
  });
  const [answer, setAnswer] = useState<string | null>(() => {
    return localStorage.getItem(QA_ANSWER_STORAGE_KEY);
  });
  const [contexts, setContexts] = useState<any[]>(() => {
    const saved = localStorage.getItem(QA_CONTEXTS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 当问题变化时，保存到 localStorage
  useEffect(() => {
    localStorage.setItem(QA_QUESTION_STORAGE_KEY, question);
  }, [question]);

  // 当答案和引用上下文变化时，保存到 localStorage
  useEffect(() => {
    if (answer) {
      localStorage.setItem(QA_ANSWER_STORAGE_KEY, answer);
    } else {
      localStorage.removeItem(QA_ANSWER_STORAGE_KEY);
    }
  }, [answer]);

  useEffect(() => {
    if (contexts && contexts.length > 0) {
      localStorage.setItem(QA_CONTEXTS_STORAGE_KEY, JSON.stringify(contexts));
    } else {
      localStorage.removeItem(QA_CONTEXTS_STORAGE_KEY);
    }
  }, [contexts]);

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

