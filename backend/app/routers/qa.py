from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..embeddings import embed_texts
from ..llm import zhipuai_client
from ..models import Knowledge, KnowledgeStatus
from ..vector_store import vector_store

router = APIRouter(prefix="/qa", tags=["qa"])


class QARequestBody:
    question: str


@router.post("/", summary="基于 RAG 的问答")
async def qa_endpoint(
    body: dict,
    db: Session = Depends(get_db),
):
    question: str = body.get("question", "")
    if not question:
        return {"answer": "", "contexts": [], "message": "问题不能为空"}

    # 1. 嵌入用户问题（使用本地 sentence-transformers 模型）
    question_embedding = embed_texts([question])[0]

    # 2. 向量检索
    search_result = vector_store.query(question_embedding, top_k=5)

    ids: List[str] = search_result.get("ids", [[]])[0]
    metadatas = search_result.get("metadatas", [[]])[0]
    documents = search_result.get("documents", [[]])[0]

    # 3. 根据检索到的 id 回查数据库（确保状态为已通过；目前先简单过滤）
    contexts = []
    for doc_id, meta, doc_content in zip(ids, metadatas, documents):
        try:
            k_id = int(meta.get("db_id", doc_id))
        except Exception:
            continue

        k: Knowledge | None = db.query(Knowledge).filter(Knowledge.id == k_id).first()
        if not k or k.status != KnowledgeStatus.VERIFIED:
            continue

        contexts.append(
            {
                "id": k.id,
                "title": k.title,
                "source": k.source,
                "content": k.content,
            }
        )

    # 如果没有任何“已通过”的知识，就直接用问题调用大模型
    if not contexts:
        try:
            answer = await zhipuai_client.chat(
                [
                    {
                        "role": "user",
                        "content": f"请回答下面的问题，并在不知道时直接说不知道：\n问题：{question}",
                    }
                ]
            )
        except RuntimeError as e:
            # 捕获 API 错误（如 402），返回友好提示
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(e),
            ) from e
        return {"answer": answer, "contexts": []}

    # 4. 构造 Prompt
    context_text = "\n\n".join(
        [f"[知识 {c['id']}] {c['title']}\n{c['content']}" for c in contexts]
    )
    system_prompt = (
        "你是一个基于可信知识库的大模型助手。"
        "请严格依据给定的知识内容回答用户问题，"
        "如果知识中没有相关信息，请明确说明不知道，不要编造。"
        "在回答结尾简要列出参考的知识ID。"
    )
    user_prompt = f"用户问题：{question}\n\n以下是可用的知识内容：\n{context_text}"

    try:
        answer = await zhipuai_client.chat(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
        )
    except RuntimeError as e:
        # 捕获 API 错误（如 402），返回友好提示
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        ) from e

    return {
        "answer": answer,
        "contexts": contexts,
    }

