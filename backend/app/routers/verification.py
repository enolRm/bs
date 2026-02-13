from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..embeddings import embed_texts
from ..models import Knowledge, KnowledgeStatus
from ..schemas import KnowledgeOut
from ..vector_store import vector_store

router = APIRouter(prefix="/verification", tags=["verification"])


@router.post(
    "/{knowledge_id}/approve",
    response_model=KnowledgeOut,
    summary="简单通过审核并入向量库（临时简化版）",
)
async def approve_knowledge(
    knowledge_id: int,
    db: Session = Depends(get_db),
) -> KnowledgeOut:
    """
    临时简化版“审核通过”接口：
    - 将知识状态置为 verified
    - 调用 智谱AI embedding 生成向量
    - 写入本地 Chroma 向量库

    后续可以将此逻辑改为由链上事件触发。
    """
    k: Knowledge | None = db.query(Knowledge).filter(Knowledge.id == knowledge_id).first()
    if not k:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识不存在")

    # 更新状态
    k.status = KnowledgeStatus.VERIFIED
    db.add(k)
    db.commit()
    db.refresh(k)

    # 生成向量并写入向量库（使用本地 sentence-transformers 模型）
    embedding = embed_texts([k.content])[0]
    vector_store.add_documents(
        ids=[str(k.id)],
        embeddings=[embedding],
        metadatas=[
            {
                "db_id": k.id,
                "title": k.title,
                "source": k.source,
                "status": k.status.value,
            }
        ],
        documents=[k.content],
    )

    return KnowledgeOut.from_orm(k)
