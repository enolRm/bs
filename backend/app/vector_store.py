from pathlib import Path
from typing import List, Dict, Any

import chromadb
from chromadb.config import Settings as ChromaSettings

from .config import settings


class VectorStore:
    """基于 ChromaDB 的简单向量库封装."""

    def __init__(self) -> None:
        Path(settings.VECTOR_DB_DIR).mkdir(parents=True, exist_ok=True)

        self._client = chromadb.PersistentClient(
            path=settings.VECTOR_DB_DIR,
            settings=ChromaSettings(anonymized_telemetry=False),
        )

        # 单集合，按知识 ID 管理
        self._collection = self._client.get_or_create_collection(
            name="knowledge_base",
            metadata={"description": "Trusted knowledge base vectors"},
        )

    def add_documents(
        self,
        ids: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict[str, Any]],
        documents: List[str],
    ) -> None:
        self._collection.add(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=documents,
        )

    def query(
        self,
        query_embedding: List[float],
        top_k: int = 5,
    ) -> Dict[str, Any]:
        return self._collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
        )

    def get_all(self, offset: int = 0, limit: int = 10) -> Dict[str, Any]:
        """分页获取所有向量数据（不含 embeddings）."""
        # 获取集合的总数
        count = self._collection.count()
        
        # 分页获取数据
        result = self._collection.get(
            include=["metadatas", "documents"],
            offset=offset,
            limit=limit
        )
        
        # 将总数放入结果中
        result["total"] = count
        return result


vector_store = VectorStore()

