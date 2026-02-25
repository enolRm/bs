import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { KnowledgeSubmitPage } from "./pages/KnowledgeSubmitPage";
import { KnowledgeVerifyPage } from "./pages/KnowledgeVerifyPage";
import { QAPage } from "./pages/QAPage";
import { TracePage } from "./pages/TracePage";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
        <h1>基于区块链与 RAG 的可信大模型知识库系统</h1>
        <nav style={{ marginBottom: 16 }}>
          <Link style={{ marginRight: 12 }} to="/submit">
            知识提交
          </Link>
          <Link style={{ marginRight: 12 }} to="/verify">
            知识验证
          </Link>
          <Link style={{ marginRight: 12 }} to="/qa">智能问答</Link>
          <Link to="/trace">知识更新与追溯</Link>
        </nav>
        <Routes>
          <Route path="/" element={<QAPage />} />
          <Route path="/submit" element={<KnowledgeSubmitPage />} />
          <Route path="/verify" element={<KnowledgeVerifyPage />} />
          <Route path="/qa" element={<QAPage />} />
          <Route path="/trace" element={<TracePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

