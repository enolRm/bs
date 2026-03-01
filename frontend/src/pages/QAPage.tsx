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
    <div className="p-6 md:p-8">
      <div className="flex items-center mb-8">
        <div className="h-10 w-10 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mr-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800">智能问答</h2>
      </div>

      <div className="space-y-6 max-w-4xl">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500 transition-all">
          <textarea
            className="w-full p-4 text-gray-700 placeholder-gray-400 border-none focus:ring-0 resize-none min-h-[120px]"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="请输入您的问题"
          />
          <div className="bg-gray-50 px-4 py-3 flex justify-end items-center border-t border-gray-100">
            <span className="text-xs text-gray-400 mr-4">支持 RAG 知识检索与智能生成</span>
            <button
              onClick={ask}
              disabled={loading || !question}
              className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center ${
                loading || !question
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-primary-600 text-white hover:bg-primary-700 shadow-sm hover:shadow active:scale-95"
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  思考中...
                </>
              ) : (
                "发送提问"
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 font-medium">错误：{error}</p>
              </div>
            </div>
          </div>
        )}

        {answer && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-primary-50 rounded-2xl p-6 border border-primary-100 shadow-sm">
              <div className="flex items-center mb-4 text-primary-800">
                <div className="bg-primary-600 h-2 w-2 rounded-full mr-2 animate-pulse"></div>
                <span className="text-sm font-bold uppercase tracking-wider">智能回答</span>
              </div>
              <div className="prose prose-blue max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap">
                {answer}
              </div>
            </div>
          </div>
        )}

        {contexts.length > 0 && (
          <div className="mt-8 pt-8 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">引用的知识库内容</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contexts.map((c, idx) => (
                <div key={c.id || idx} className="bg-gray-50 border border-gray-200 rounded-xl p-4 hover:border-primary-300 transition-colors group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700 group-hover:bg-primary-100 group-hover:text-primary-700">
                      ID: {c.id}
                    </span>
                    <span className="text-xs text-gray-400">{"来源：" + (c.source || "系统内置")}</span>
                  </div>
                  <h4 className="text-sm font-bold text-gray-800 mb-2 line-clamp-1">{c.title}</h4>
                  <p className="text-xs text-gray-500 line-clamp-2">{c.content || "内容摘要加载中..."}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


