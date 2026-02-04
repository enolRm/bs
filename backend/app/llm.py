from typing import List, Optional

import httpx

from .config import settings


def _mock_chat_response(messages: List[dict]) -> str:
    """模拟 LLM 响应（用于演示，当 API 不可用时）"""
    user_message = ""
    for msg in messages:
        if msg.get("role") == "user":
            user_message = msg.get("content", "")
            break
    
    # 简单的基于规则的回复
    if "知识" in user_message or "系统" in user_message:
        return (
            f"根据您的问题：{user_message}\n\n"
            "基于知识库中的信息，我可以提供以下回答：\n"
            "（这是模拟响应，实际使用时需要配置有效的 DeepSeek API Key 并确保账户有余额）\n\n"
            "如果您看到这条消息，说明 DeepSeek API 当前不可用（可能是账户余额不足）。"
            "请检查 API Key 和账户余额，或设置 USE_MOCK_LLM=true 以启用模拟模式进行演示。"
        )
    return f"模拟回答：关于您的问题「{user_message}」，这是一个演示用的模拟响应。实际使用时需要配置有效的 DeepSeek API。"


class DeepSeekClient:
    """简单封装 DeepSeek Chat / Embedding API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        embed_model: Optional[str] = None,
    ) -> None:
        self.api_key = api_key or settings.DEEPSEEK_API_KEY
        self.base_url = base_url or settings.DEEPSEEK_BASE_URL
        self.model = model or settings.DEEPSEEK_MODEL
        self.embed_model = embed_model or settings.DEEPSEEK_EMBED_MODEL

        if not self.api_key:
            raise RuntimeError("DEEPSEEK_API_KEY 未配置，请在环境变量或 .env 中设置。")

    async def chat(
        self,
        messages: List[dict],
        temperature: float = 0.2,
        max_tokens: int = 1024,
    ) -> str:
        """调用 DeepSeek 对话接口，返回生成文本。"""
        # 如果启用了模拟模式，直接返回模拟响应
        if settings.USE_MOCK_LLM:
            return _mock_chat_response(messages)
        
        url = f"{self.base_url}/chat/completions"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()

            # 兼容常见 OpenAI 风格返回
            return data["choices"][0]["message"]["content"]
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 402:
                # 402 Payment Required - 账户余额不足或需要付费
                # 如果启用了模拟模式，降级到模拟响应
                if settings.USE_MOCK_LLM:
                    return _mock_chat_response(messages)
                raise RuntimeError(
                    "DeepSeek API 返回 402 错误：账户余额不足或需要付费。\n"
                    "请检查你的 DeepSeek 账户余额，或使用其他 API Key。\n"
                    "如需演示，可以在 .env 中设置 USE_MOCK_LLM=true 启用模拟模式。"
                ) from e
            raise

    async def embed(self, texts: List[str]) -> List[List[float]]:
        """调用 DeepSeek 向量接口，返回向量列表。"""
        url = f"{self.base_url}/embeddings"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.embed_model,
            "input": texts,
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        # OpenAI 风格：data: [{embedding: [...]}]
        return [item["embedding"] for item in data["data"]]


deepseek_client = DeepSeekClient()

