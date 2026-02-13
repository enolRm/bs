import hashlib
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import settings

from ..db import get_db

router = APIRouter(prefix="/knowledge", tags=["knowledge"])
logger = logging.getLogger(__name__)


def _calc_content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


@router.post("/", response_model=schemas.KnowledgeOut, summary="提交知识")
def create_knowledge(
    payload: schemas.KnowledgeCreate,
    db: Session = Depends(get_db),
) -> schemas.KnowledgeOut:
    """
    提交知识：
    - 先在本地数据库保存全文与元数据
    - 若已配置链上环境（CONTRACT_ADDRESS + CHAIN_SENDER_*），则同步上链并回写 chain_id
    """
    content_hash = _calc_content_hash(payload.content)

    knowledge = models.Knowledge(
        title=payload.title,
        content=payload.content,
        content_hash=content_hash,
        source=payload.source,
        status=models.KnowledgeStatus.PENDING,
    )
    db.add(knowledge)
    db.commit()
    db.refresh(knowledge)

    return knowledge


@router.get("/{knowledge_id}", response_model=schemas.KnowledgeOut, summary="获取知识详情")
def get_knowledge(
    knowledge_id: int,
    db: Session = Depends(get_db),
) -> schemas.KnowledgeOut:
    knowledge = db.query(models.Knowledge).filter(models.Knowledge.id == knowledge_id).first()
    if not knowledge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识不存在")
    return knowledge


@router.patch("/{knowledge_id}", response_model=schemas.KnowledgeOut, summary="更新知识（记录历史哈希）")
def update_knowledge(
    knowledge_id: int,
    payload: schemas.KnowledgeUpdate,
    db: Session = Depends(get_db),
) -> schemas.KnowledgeOut:
    """
    更新知识：仅更新提供的字段。
    若 content 有变更，会先将当前 content_hash 写入 knowledge_history，再更新。
    """
    knowledge = db.query(models.Knowledge).filter(models.Knowledge.id == knowledge_id).first()
    if not knowledge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识不存在")

    if payload.title is not None:
        knowledge.title = payload.title
    if payload.source is not None:
        knowledge.source = payload.source
    if payload.content is not None:
        new_hash = _calc_content_hash(payload.content)
        if new_hash != knowledge.content_hash:
            db.add(
                models.KnowledgeHistory(
                    knowledge_id=knowledge_id,
                    content_hash=knowledge.content_hash,
                )
            )
            knowledge.content = payload.content
            knowledge.content_hash = new_hash
    db.add(knowledge)
    db.commit()
    db.refresh(knowledge)
    return knowledge


@router.get("/{knowledge_id}/history", summary="获取知识更新历史（内容哈希追溯）")
def get_knowledge_history(
    knowledge_id: int,
    db: Session = Depends(get_db),
):
    knowledge = db.query(models.Knowledge).filter(models.Knowledge.id == knowledge_id).first()
    if not knowledge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识不存在")
    rows = (
        db.query(models.KnowledgeHistory)
        .filter(models.KnowledgeHistory.knowledge_id == knowledge_id)
        .order_by(models.KnowledgeHistory.created_at.desc())
        .limit(50)
        .all()
    )
    return [schemas.KnowledgeHistoryOut.from_orm(r) for r in rows]


@router.get("/", summary="列出知识（简单版）")
def list_knowledge(
    db: Session = Depends(get_db),
):
    items = db.query(models.Knowledge).order_by(models.Knowledge.id.desc()).limit(50).all()
    return [schemas.KnowledgeOut.from_orm(item) for item in items]

