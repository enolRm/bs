import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { KnowledgeSubmitPage } from "./pages/KnowledgeSubmitPage";
import { QAPage } from "./pages/QAPage";
import { TracePage } from "./pages/TracePage";
import { VectorListPage } from "./pages/VectorListPage";
import { WarningListPage } from "./pages/WarningListPage";
import { DBAdminPage } from "./pages/DBAdminPage";
import { knowledgeApi } from "./api";
import { useAuth, AuthProvider } from "./hooks/useAuth";
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
  const { user, login, logout, loading } = useAuth();

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
              </div>

              <nav className="flex items-center space-x-2">
                  <NavLink to="/qa">智能问答</NavLink>
                  <NavLink to="/submit">知识提交</NavLink>
                  <NavLink to="/trace">知识列表</NavLink>
                  <NavLink to="/vector">向量列库</NavLink>
                  <NavLink to="/warnings" badge={unprocessedCount}>
                    警告信息
                  </NavLink>
                  <NavLink to="/db-admin">数据库(演示用)</NavLink>
                
                <div className="ml-4 pl-4 border-l border-gray-200">
                  {user ? (
                    <div className="flex items-center space-x-3">
                      <div className="text-right hidden sm:block">
                        <div className="text-xs font-medium text-gray-900">
                          {user.address.slice(0, 6)}...{user.address.slice(-4)}
                        </div>
                        <div className="text-[10px] text-gray-500 uppercase">
                          {user.role}
                        </div>
                      </div>
                      <button
                        onClick={logout}
                        className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
                        title="退出登录"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={login}
                      disabled={loading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
                    >
                      {loading ? (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      )}
                      {loading ? '连接中...' : '连接钱包'}
                    </button>
                  )}
                </div>
              </nav>
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
              <Route path="/db-admin" element={<DBAdminPage />} />
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
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

