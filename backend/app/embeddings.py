import os
import logging
from typing import List
from .llm import zhipuai_client

logger = logging.getLogger(__name__)

def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    使用 智谱AI Embedding API 生成文本语义向量。
    不再依赖本地 Transformer 模型，彻底解决网络环境导致的加载失败问题。
    """
    if not texts:
        return []
    
    try:
        # 由于 ZhipuAI SDK 是同步的，我们直接调用即可
        # 注意：如果 texts 列表很大，建议分批调用（SDK 本身通常有单次请求限制）
        response = zhipuai_client.client.embeddings.create(
            model=zhipuai_client.embed_model,
            input=texts,
        )
        return [data.embedding for data in response.data]
    except Exception as e:
        logger.error(f"智谱AI Embedding 调用失败: {e}")
        # 如果调用失败，抛出异常以告知业务方
        raise e

