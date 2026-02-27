from typing import List, Optional

import zhipuai

from .config import settings


def _mock_chat_response(messages: List[dict]) -> str:
    """模拟 LLM 响应（用于演示，当 API 不可用时）"""
    user_message = ""
    for msg in messages:
        if msg.get("role") == "user":
            user_message = msg.get("content", "")
            break
    
    # 简单的基于规则的回复
    if "以下是可用的知识内容：" in user_message:
        # 尝试提取一些知识 ID 来模拟回答
        import re
        ids = re.findall(r"\[知识 (\d+)\]", user_message)
        if ids:
            # 模拟：如果有多个 ID，只提及前两个，不要提到剩下的
            # 这样可以模拟过滤掉无关知识的效果
            return (
                f"根据您提供的知识（ID: {ids[0]}），我可以回答：\n"
                "这是一个基于知识库的模拟回答。请注意，我没有在正文中提及或分析不相关的知识 ID。\n\n"
                f"【参考知识ID：{ids[0]}】"
            )
        else:
            return (
                "抱歉，我没有在提供的知识中找到相关信息。\n\n"
                "【参考知识ID：无】"
            )

    if "知识" in user_message or "系统" in user_message:
        return (
            f"根据您的问题：{user_message}\n\n"
            "基于知识库中的信息，我可以提供以下回答：\n"
            "（这是模拟响应，实际使用时需要配置有效的 智谱AI API Key 并确保账户有余额）\n\n"
            "如果您看到这条消息，说明 智谱AI API 当前不可用（可能是账户余额不足）。"
            "请检查 API Key 和账户余额，或设置 USE_MOCK_LLM=true 以启用模拟模式进行演示。"
        )
    return f"模拟回答：关于您的问题「{user_message}」，这是一个演示用的模拟响应。实际使用时需要配置有效的 智谱AI API。"


class ZhipuAIClient:
    """简单封装 智谱AI Chat / Embedding API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        embed_model: Optional[str] = None,
    ) -> None:
        self.api_key = api_key or settings.ZHIPUAI_API_KEY
        self.model = model or settings.ZHIPUAI_MODEL
        self.embed_model = embed_model or settings.ZHIPUAI_EMBED_MODEL

        if not self.api_key:
            raise RuntimeError("ZHIPUAI_API_KEY 未配置，请在环境变量或 .env 中设置。")

        self.client = zhipuai.ZhipuAI(api_key=self.api_key)

    async def chat(
        self,
        messages: List[dict],
        temperature: float = 0.2,
        max_tokens: int = 1024,
    ) -> str:
        """调用 智谱AI 对话接口，返回生成文本。"""
        # 如果启用了模拟模式，直接返回模拟响应
        if settings.USE_MOCK_LLM:
            return _mock_chat_response(messages)
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content
        except Exception as e:
            if "402" in str(e) or "balance" in str(e).lower():
                # 账户余额不足
                if settings.USE_MOCK_LLM:
                    return _mock_chat_response(messages)
                raise RuntimeError(
                    "智谱AI API 返回错误：账户余额不足或需要付费。\n"
                    "请检查你的 智谱AI 账户余额，或使用其他 API Key。\n"
                    "如需演示，可以在 .env 中设置 USE_MOCK_LLM=true 启用模拟模式。"
                ) from e
            raise

    async def embed(self, texts: List[str]) -> List[List[float]]:
        """调用 智谱AI 向量接口，返回向量列表。"""
        response = self.client.embeddings.create(
            model=self.embed_model,
            input=texts,
        )
        return [data.embedding for data in response.data]


zhipuai_client = ZhipuAIClient()

