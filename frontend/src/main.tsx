import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { KnowledgeSubmitPage } from "./pages/KnowledgeSubmitPage";
import { QAPage } from "./pages/QAPage";
import { TracePage } from "./pages/TracePage";
import { VectorListPage } from "./pages/VectorListPage";
import { WarningListPage } from "./pages/WarningListPage";
import { knowledgeApi } from "./api";

const App: React.FC = () => {
  const [unprocessedCount, setUnprocessedCount] = useState(0);

  useEffect(() => {
    // 建立 WebSocket 连接实现实时通知
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // 这里硬编码 8000 端口，实际应根据配置或环境变量
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
        console.log("WebSocket 连接已断开，尝试重连...");
        reconnectTimer = window.setTimeout(connect, 3000);
      };

      socket.onerror = (error) => {
        console.error("WebSocket 错误:", error);
        socket?.close();
      };
    };

    connect();

    // 监听本地更新事件（为了处理本页面的即时反馈，虽然 WS 也会广播，但本地事件更快）
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
        socket.onclose = null; // 清除重连逻辑
        socket.close();
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      window.removeEventListener("update-warning-count", handleUpdate);
    };
  }, []);

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
          <Link style={{ marginRight: 12 }} to="/vector">向量列表</Link>
          <Link to="/warnings" style={{ position: "relative" }}>
            警告信息
            {unprocessedCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -6,
                  right: -10,
                  backgroundColor: "red",
                  color: "white",
                  borderRadius: "50%",
                  width: 16,
                  height: 16,
                  fontSize: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {unprocessedCount > 99 ? "99+" : unprocessedCount}
              </span>
            )}
          </Link>
        </nav>
        <Routes>
          <Route path="/" element={<QAPage />} />
          <Route path="/submit" element={<KnowledgeSubmitPage />} />
          <Route path="/qa" element={<QAPage />} />
          <Route path="/trace" element={<TracePage />} />
          <Route path="/vector" element={<VectorListPage />} />
          <Route path="/warnings" element={<WarningListPage />} />
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

