import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000
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

