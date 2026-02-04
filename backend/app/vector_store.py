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


vector_store = VectorStore()

