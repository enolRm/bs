import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { KnowledgeSubmitPage } from "./pages/KnowledgeSubmitPage";
import { QAPage } from "./pages/QAPage";
import { TracePage } from "./pages/TracePage";
import { VectorListPage } from "./pages/VectorListPage";
import { WarningListPage } from "./pages/WarningListPage";
import { knowledgeApi } from "./api";
import "./index.css";

const NavLink: React.FC<{ to: string; children: React.ReactNode; badge?: number }> = ({ to, children, badge }) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to === "/qa" && location.pathname === "/");
  
  return (
    <Link
      to={to}
      className={`relative px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? "bg-primary-100 text-primary-700"
          : "text-gray-600 hover:bg-gray-50 hover:text-primary-600"
      }`}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
};

const App: React.FC = () => {
  const [unprocessedCount, setUnprocessedCount] = useState(0);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.hostname}:8000/api/v1/warnings/ws`;
    
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connect = () => {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "unprocessed_count") {
            setUnprocessedCount(data.count);
          }
        } catch (e) {
          console.error("解析 WebSocket 消息失败:", e);
        }
      };
      socket.onclose = () => {
        reconnectTimer = window.setTimeout(connect, 3000);
      };
      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    const handleUpdate = async () => {
      try {
        const { count } = await knowledgeApi.getUnprocessedCount();
        setUnprocessedCount(count);
      } catch (e) {
        console.error("获取数量失败:", e);
      }
    };
    window.addEventListener("update-warning-count", handleUpdate);

    return () => {
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      window.removeEventListener("update-warning-count", handleUpdate);
    };
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center">
                  <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold mr-3">
                    B
                  </div>
                  <h1 className="text-xl font-bold text-gray-900 hidden md:block">
                    可信大模型知识库系统
                  </h1>
                </div>
                <nav className="ml-10 flex space-x-2">
                  <NavLink to="/qa">智能问答</NavLink>
                  <NavLink to="/submit">知识提交</NavLink>
                  <NavLink to="/trace">知识列表</NavLink>
                  <NavLink to="/vector">向量列表</NavLink>
                  <NavLink to="/warnings" badge={unprocessedCount}>警告信息</NavLink>
                </nav>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[calc(100vh-10rem)]">
            <Routes>
              <Route path="/" element={<QAPage />} />
              <Route path="/submit" element={<KnowledgeSubmitPage />} />
              <Route path="/qa" element={<QAPage />} />
              <Route path="/trace" element={<TracePage />} />
              <Route path="/vector" element={<VectorListPage />} />
              <Route path="/warnings" element={<WarningListPage />} />
            </Routes>
          </div>
        </main>

        <footer className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-gray-400 text-sm">
          &copy; 基于区块链与 RAG 的可信大模型知识库系统
        </footer>
      </div>
    </BrowserRouter>
  );
};


ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

