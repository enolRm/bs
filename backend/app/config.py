import os
from functools import lru_cache

from dotenv import load_dotenv


load_dotenv()


class Settings:
    """全局配置."""

    # 基本信息
    PROJECT_NAME: str = "Trusted RAG Knowledge Base"
    API_V1_PREFIX: str = "/api/v1"

    # 智谱AI 相关
    ZHIPUAI_API_KEY: str | None = os.getenv("ZHIPUAI_API_KEY")
    ZHIPUAI_MODEL: str = os.getenv("ZHIPUAI_MODEL", "glm-4")
    ZHIPUAI_EMBED_MODEL: str = os.getenv("ZHIPUAI_EMBED_MODEL", "embedding-2")
    # 是否使用模拟模式（当 API 不可用时，用于演示）
    USE_MOCK_LLM: bool = os.getenv("USE_MOCK_LLM", "false").lower() == "true"

    # 数据库
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./knowledge.db")

    # TBAAS 长安链配置
    TBAAS_SECRET_ID: str | None = os.getenv("TBAAS_SECRET_ID")
    TBAAS_SECRET_KEY: str | None = os.getenv("TBAAS_SECRET_KEY")
    TBAAS_CLUSTER_ID: str = os.getenv("TBAAS_CLUSTER_ID", "chainmaker-demo")
    TBAAS_CHAIN_ID: str = os.getenv("TBAAS_CHAIN_ID", "chain_demo")
    TBAAS_CONTRACT_NAME: str = os.getenv("TBAAS_CONTRACT_NAME", "bs")

    # 向量库
    VECTOR_DB_DIR: str = os.getenv("VECTOR_DB_DIR", "./vector_store")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

