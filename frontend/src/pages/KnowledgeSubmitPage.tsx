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
    <div className="p-6 md:p-8">
      <div className="flex items-center mb-8">
        <div className="h-10 w-10 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mr-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800">知识提交</h2>
      </div>

      <div className="max-w-3xl space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 block">知识标题</label>
            <input
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 block">来源</label>
            <input
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="例如：网址链接、文档名称...没有则输入无"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 block">正文内容</label>
          <textarea
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none min-h-[240px] resize-y"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="请在此输入需要存证的知识库正文内容..."
          />
        </div>

        <div className="bg-blue-50/50 rounded-xl p-6 border border-blue-100">
          <h3 className="text-sm font-bold text-blue-800 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            投票时长设置
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex space-x-2">
                <input
                  type="number"
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none"
                  value={voteDuration}
                  onChange={(e) => setVoteDuration(parseInt(e.target.value) || 0)}
                  min={1}
                />
                <select
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none bg-white"
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
            <div className="flex items-end">
              <p className="text-xs text-gray-500 italic">
                提交后将进入投票流程，只有通过验证的知识才会被同步到 RAG 向量库。
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {title && content && source ? (
              <span className="text-green-600 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                表单已就绪
              </span>
            ) : (
              "请填写所有必填字段"
            )}
          </div>
          <button
            onClick={submit}
            disabled={loading || !title || !content || !source}
            className={`px-10 py-3 rounded-xl font-bold transition-all shadow-md ${
              loading || !title || !content || !source
                ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                : "bg-primary-600 text-white hover:bg-primary-700 hover:shadow-lg active:scale-95"
            }`}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                正在存证...
              </span>
            ) : (
              "提交存证"
            )}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
            <p className="text-sm text-red-700 font-medium flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              提交失败：{error}
            </p>
          </div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 animate-in zoom-in duration-300">
            <div className="flex items-center text-green-800 font-bold mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              知识提交成功
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-gray-500">系统内部 ID</p>
                <p className="font-mono font-bold text-gray-900">{result.id}</p>
              </div>
              <div className="space-y-1">
                <p className="text-gray-500">区块链存证 ID</p>
                <p className="font-mono font-bold text-primary-700">
                  {result.chain_id != null ? result.chain_id : "未上链"}
                </p>
              </div>
              <div className="md:col-span-2 space-y-1">
                <p className="text-gray-500">内容哈希</p>
                <p className="font-mono text-xs bg-white p-2 border border-green-100 rounded break-all">
                  {result.content_hash}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-green-700">
              提示：该知识已成功提交并进入待投票状态。您可以在“知识列表”页面查看进度并参与验证。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};


