import re
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..embeddings import embed_texts
from ..llm import zhipuai_client
from ..models import Knowledge, KnowledgeStatus, WarningMessage
from ..vector_store import vector_store
from ..blockchain import get_blockchain_client
from ..utils import calc_knowledge_hash
from ..config import settings
from .warnings import manager # 引入 WebSocket 管理器

router = APIRouter(prefix="/qa", tags=["qa"])
logger = logging.getLogger(__name__)


async def _generate_answer_without_context(question: str):
    try:
        answer = await zhipuai_client.chat(
            [
                {
                    "role": "user",
                    "content": f"请回答下面的问题，并在不知道时直接只说不知道：\n问题：{question}",
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

    # 3. 根据检索到的 id 回查数据库并验证区块链数据一致性
    contexts = []
    
    # 首先从数据库批量加载，过滤已通过的状态
    db_knowledges = []
    for doc_id, meta in zip(ids, metadatas):
        try:
            k_id = int(meta.get("db_id", doc_id))
        except Exception:
            continue
        k = db.query(Knowledge).filter(Knowledge.id == k_id).first()
        if k and k.status == KnowledgeStatus.VERIFIED and k.chain_id:
            db_knowledges.append(k)

    if not db_knowledges:
        return await _generate_answer_without_context(question)

    # 如果配置了区块链，则进行链上一致性校验
    if settings.TBAAS_SECRET_ID and settings.TBAAS_SECRET_KEY:
        try:
            client = get_blockchain_client()
            chain_ids = [k.chain_id for k in db_knowledges]
            chain_results = client.query_knowledge_by_ids(chain_ids)
            
            # 将链上结果转为 map 方便查找
            chain_map = {item["id"]: item for item in chain_results}
            
            warnings_added = False
            for k in db_knowledges:
                chain_k = chain_map.get(k.chain_id)
                if not chain_k:
                    error_msg = f"知识 {k.id} (chain_id: {k.chain_id}) 在链上未找到"
                    logger.warning(error_msg)
                    db.add(WarningMessage(knowledge_id=k.id, chain_id=k.chain_id, error_message=error_msg))
                    db.commit()
                    warnings_added = True
                    continue
                
                # 校验状态 (链上 Status 1 为 Approved)
                if chain_k.get("status") != 1:
                    error_msg = f"知识 {k.id} 链上状态不匹配:\n本地=1 (Approved), 链上='{chain_k.get('status')}'"
                    logger.warning(error_msg)
                    db.add(WarningMessage(knowledge_id=k.id, chain_id=k.chain_id, error_message=error_msg))
                    db.commit()
                    warnings_added = True
                    continue
                
                # 校验字段一致性
                # 1. 验证ID
                if k.verification_id != chain_k.get("verification_id"):
                    error_msg = f"知识 {k.id} 验证ID不一致:\n本地='{k.verification_id}', 链上='{chain_k.get('verification_id')}'"
                    logger.warning(error_msg)
                    db.add(WarningMessage(knowledge_id=k.id, chain_id=k.chain_id, error_message=error_msg))
                    db.commit()
                    warnings_added = True
                    continue
                
                # 2. 哈希校验：
                # 重新计算本地内容的哈希
                recalc_hash = calc_knowledge_hash(k.title, k.source, k.content)
                
                # a. 与本地数据库存储的哈希比对 (确保本地数据内部一致)
                if recalc_hash != k.content_hash:
                    error_msg = f"知识 {k.id} 根据本地内容重新计算的哈希与本地存储哈希不一致:\n计算值='{recalc_hash}', 存储值='{k.content_hash}'"
                    logger.warning(error_msg)
                    db.add(WarningMessage(knowledge_id=k.id, chain_id=k.chain_id, error_message=error_msg))
                    db.commit()
                    warnings_added = True
                    continue
                
                # b. 与链上记录的数据比对 (确保链上链下数据一致)
                if recalc_hash != chain_k.get("content_hash"):
                    error_msg = f"知识 {k.id} 根据本地内容重新计算的哈希与链上哈希不一致:\n计算值='{recalc_hash}', 链上值='{chain_k.get('content_hash')}'"
                    logger.warning(error_msg)
                    db.add(WarningMessage(knowledge_id=k.id, chain_id=k.chain_id, error_message=error_msg))
                    db.commit()
                    warnings_added = True
                    continue
                
                # 校验通过
                contexts.append({
                    "id": k.id,
                    "title": k.title,
                    "source": k.source,
                    "content": k.content,
                })
            
            # 如果新增了警告，广播通知
            if warnings_added:
                await manager.broadcast_count(db)

        except Exception as e:
            logger.error(f"区块链一致性校验异常: {e}")
            # 如果校验过程出错，出于安全性考虑，暂时不使用这些知识。
            # 这里选择谨慎：如果不一致性校验过程中断（如网络问题），则不将这些知识加入 context。
    else:
        # 未配置区块链，仅依赖本地状态
        for k in db_knowledges:
            contexts.append({
                "id": k.id,
                "title": k.title,
                "source": k.source,
                "content": k.content,
            })

    # 如果过滤后没有任何“已通过”且“一致”的知识
    if not contexts:
        return await _generate_answer_without_context(question)

    # 4. 构造 Prompt
    context_text = "\n\n".join(
        [f"[知识 {c['id']}] {c['title']}\n{c['content']}" for c in contexts]
    )
    system_prompt = (
        "你是一个基于可信知识库的大模型助手。"
        "请严格依据给定的知识内容回答用户问题，"
        "如果知识中没有相关信息，请明确说明不知道，不要编造。"
        "注意：在回答正文中，请仅提及与答案直接相关的知识内容。不要在正文中解释、分析或提及任何不相关的知识条目（例如：不要解释为什么某条知识不相关）。"
        "在回答结尾，请务必按照以下格式列出你实际引用到的知识 ID：\n"
        "【参考知识ID：ID1, ID2, ...】\n"
        "注意：只列出你真正用于生成回答的知识 ID。如果没有引用任何知识，请写：【参考知识ID：无】"
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

    # 5. 解析回答中的知识 ID 并过滤 contexts
    # 尝试从回答中提取 【参考知识ID：...】 格式的内容
    referenced_ids = []
    # 匹配中文或英文冒号，匹配多种可能的 ID 分隔符
    match = re.search(r"【参考知识ID[:：](.*?)】", answer)
    if match:
        ids_str = match.group(1)
        if "无" not in ids_str:
            # 提取所有数字作为 ID
            try:
                referenced_ids = [int(i) for i in re.findall(r"\d+", ids_str)]
            except ValueError:
                referenced_ids = []
    
    # 过滤 contexts，只保留模型声称引用的知识
    if referenced_ids:
        filtered_contexts = [c for c in contexts if c["id"] in referenced_ids]
    else:
        # 如果模型没有按格式提供 ID 或说“无”，则认为没有使用知识
        # 为了保险，如果模型虽然没按格式写但在文本中提到了某些 ID，我们也可以尝试匹配
        # 但目前先严格按照格式来，这有助于引导模型输出
        filtered_contexts = []

    return {
        "answer": answer,
        "contexts": filtered_contexts,
    }

