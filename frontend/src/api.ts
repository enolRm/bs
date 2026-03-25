import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000
});

// 添加请求拦截器
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export type Knowledge = {
  id: number;
  chain_id: string | null;
  title: string;
  content: string;
  content_hash: string;
  source: string | null;
  submitter_address: string | null;
  created_at: string;
  voting_deadline: string | null;
  status: "pending" | "verified" | "rejected";
};

export type KnowledgeHistoryItem = {
  id: number;
  knowledge_id: number;
  title: string | null;
  content: string | null;
  content_hash: string;
  source: string | null;
  operator: string | null;
  chain_id: string | null;
  status: string | null;
  created_at: string;
};

export type VoteDetails = {
  content_hash: string;
  agree_count: number;
  reject_count: number;
  agree_voters: string[];
  reject_voters: string[];
};

export type VectorData = {
  ids: string[];
  metadatas: Record<string, any>[];
  documents: string[];
  total: number;
};

export type WarningMessage = {
  id: number;
  knowledge_id: number | null;
  chain_id: string | null;
  error_message: string;
  is_processed: number;
  created_at: string;
};

// --- API Functions ---

export const authApi = {
  getNonce: async (address: string) => {
    const res = await api.post<{ nonce: string }>("/auth/nonce", { address });
    return res.data;
  },
  login: async (address: string, signature: string) => {
    const res = await api.post<{ access_token: string; token_type: string }>("/auth/login", {
      address,
      signature,
    });
    return res.data;
  },
  getMe: async () => {
    const res = await api.get<{ address: string; role: string; created_at: string }>("/auth/me");
    return res.data;
  },
};

export const knowledgeApi = {
  getVectorList: async () => {
    const res = await api.get<VectorData>("/vector/list");
    return res.data;
  },
  getWarnings: async () => {
    const res = await api.get<WarningMessage[]>("/warnings/");
    return res.data;
  },
  getUnprocessedCount: async () => {
    const res = await api.get<{ count: number }>("/warnings/unprocessed_count");
    return res.data;
  },
  deleteWarning: async (id: number) => {
    const res = await api.delete(`/warnings/${id}`);
    return res.data;
  },
  processWarning: async (id: number) => {
    const res = await api.post(`/warnings/${id}/process`);
    return res.data;
  },
  deleteKnowledge: async (id: number) => {
    const res = await api.delete(`/knowledge/${id}`);
    return res.data;
  },
};

export const dbAdminApi = {
  listTables: async () => {
    const res = await api.get<string[]>("/db-admin/tables");
    return res.data;
  },
  getTableData: async (tableName: string, page: number = 1, pageSize: number = 20) => {
    const res = await api.get<{
      table_name: string;
      columns: string[];
      total_count: number;
      page: number;
      page_size: number;
      data: any[];
    }>(`/db-admin/tables/${tableName}/data`, {
      params: { page, page_size: pageSize }
    });
    return res.data;
  },
  deleteRow: async (tableName: string, rowId: number, idColumn: string = "id") => {
    const res = await api.delete(`/db-admin/tables/${tableName}/rows/${rowId}`, {
      params: { id_column: idColumn }
    });
    return res.data;
  },
  updateRow: async (tableName: string, rowId: number, data: any, idColumn: string = "id") => {
    const res = await api.put(`/db-admin/tables/${tableName}/rows/${rowId}`, data, {
      params: { id_column: idColumn }
    });
    return res.data;
  }
};

