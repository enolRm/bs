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

    # 区块链
    WEB3_RPC_URL: str = os.getenv("WEB3_RPC_URL", "http://127.0.0.1:8545")
    CONTRACT_ADDRESS: str | None = os.getenv("CONTRACT_ADDRESS")
    # 默认指向 Hardhat 编译产物（可在 .env 中覆盖）
    CONTRACT_ABI_PATH: str = os.getenv(
        "CONTRACT_ABI_PATH",
        "../contracts/artifacts/contracts/KnowledgeStorage.sol/KnowledgeStorage.json",
    )
    # 后端代签名账户（演示用：后端直接发交易；生产应改为前端钱包签名）
    CHAIN_SENDER_ADDRESS: str | None = os.getenv("CHAIN_SENDER_ADDRESS")
    CHAIN_SENDER_PRIVATE_KEY: str | None = os.getenv("CHAIN_SENDER_PRIVATE_KEY")

    # 向量库
    VECTOR_DB_DIR: str = os.getenv("VECTOR_DB_DIR", "./vector_store")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

