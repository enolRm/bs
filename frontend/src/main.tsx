import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { KnowledgeSubmitPage } from "./pages/KnowledgeSubmitPage";
import { QAPage } from "./pages/QAPage";
import { TracePage } from "./pages/TracePage";
import { VectorListPage } from "./pages/VectorListPage";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
        <h1>基于区块链与 RAG 的可信大模型知识库系统</h1>
        <nav style={{ marginBottom: 16 }}>
          <Link style={{ marginRight: 12 }} to="/submit">
            知识提交
          </Link>
          <Link style={{ marginRight: 12 }} to="/qa">智能问答</Link>
          <Link style={{ marginRight: 12 }} to="/trace">知识列表</Link>
          <Link to="/vector">向量列表</Link>
        </nav>
        <Routes>
          <Route path="/" element={<QAPage />} />
          <Route path="/submit" element={<KnowledgeSubmitPage />} />
          <Route path="/qa" element={<QAPage />} />
          <Route path="/trace" element={<TracePage />} />
          <Route path="/vector" element={<VectorListPage />} />
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

