import hashlib
import logging
import time
from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import settings

from ..db import get_db
from ..blockchain import get_blockchain_client
from ..verification_scheduler import schedule_verification

router = APIRouter(prefix="/knowledge", tags=["knowledge"])
logger = logging.getLogger(__name__)


def _calc_knowledge_hash(title: str, source: str, content: str) -> str:
    combined_string = f"{title}|{source}|{content}"
    return hashlib.sha256(combined_string.encode("utf-8")).hexdigest()


@router.post("/", response_model=schemas.KnowledgeOut, summary="提交知识")
def create_knowledge(
    payload: schemas.KnowledgeCreate,
    db: Session = Depends(get_db),
) -> schemas.KnowledgeOut:
    """
    提交知识：
    - 先在本地数据库保存全文与元数据
    - 调用 TBAAS 长安链合约 `submitKnowledge` 上链
    """
    knowledge_hash = _calc_knowledge_hash(payload.title, payload.source, payload.content)

    knowledge = models.Knowledge(
        title=payload.title,
        content=payload.content,
        content_hash=knowledge_hash,
        source=payload.source,
        status=models.KnowledgeStatus.PENDING,
    )
    db.add(knowledge)
    db.commit()
    db.refresh(knowledge)

    if (
        settings.TBAAS_SECRET_ID
        and settings.TBAAS_SECRET_KEY
    ):
        try:
            # 计算投票时长（毫秒）
            unit_map = {"s": 1, "m": 60, "h": 3600, "d": 86400}
            duration_sec = payload.vote_duration * unit_map.get(payload.vote_unit, 1)
            duration_ms = duration_sec * 1000

            client = get_blockchain_client()
            result = client.submit_knowledge(
                id=str(knowledge.id),
                content_hash=knowledge_hash,
                source_credential=payload.source or "",
                submitter="TODO: get actual submitter from auth context",  # 替换为实际提交者
                timestamp_ms=int(knowledge.created_at.replace(tzinfo=timezone.utc).timestamp() * 1000),
                vote_duration_ms=duration_ms,
            )
            knowledge.chain_id = knowledge.id   # 知识的链上id和自身id一致
            db.commit()
            
            # 开启定时器，默认在投票结束后稍晚一点检查验证结果（秒）
            schedule_verification(knowledge.id, duration_sec + 2)
        except Exception as e:
            logger.warning("提交知识上链失败，本地已保存，error: %s", e)

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
    若 content 有变更，会将当前 content_hash 写入 knowledge_history。
    """
    knowledge = db.query(models.Knowledge).filter(models.Knowledge.id == knowledge_id).first()
    if not knowledge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识不存在")

    # Store original hash for history if content changes
    old_knowledge_hash = knowledge.content_hash

    # Apply updates from payload to the knowledge object
    if payload.title is not None:
        knowledge.title = payload.title
    if payload.source is not None:
        knowledge.source = payload.source
    if payload.content is not None:
        knowledge.content = payload.content

    # Calculate the new hash based on the updated knowledge object
    new_knowledge_hash = _calc_knowledge_hash(knowledge.title, knowledge.source, knowledge.content)

    # Check if the overall knowledge hash has changed
    if new_knowledge_hash != old_knowledge_hash:
        # If the hash has changed, we need to attempt a blockchain update
        if settings.TBAAS_SECRET_ID and settings.TBAAS_SECRET_KEY:
            try:
                # 计算投票时长（毫秒）
                unit_map = {"s": 1, "m": 60, "h": 3600, "d": 86400}
                v_duration = payload.vote_duration if payload.vote_duration is not None else 60
                v_unit = payload.vote_unit if payload.vote_unit is not None else "s"
                duration_sec = v_duration * unit_map.get(v_unit, 1)
                duration_ms = duration_sec * 1000

                client = get_blockchain_client()
                client.update_knowledge(
                    id=str(knowledge_id),
                    new_content_hash=new_knowledge_hash, # Use the new combined hash
                    new_source_credential=knowledge.source or "",
                    operator="system_operator",  # Placeholder
                    operator_role="2",  # Placeholder
                    new_update_record_hash=hashlib.sha256(new_knowledge_hash.encode("utf-8")).hexdigest(),  # Placeholder
                    timestamp_ms=int(time.time() * 1000),
                    vote_duration_ms=duration_ms,
                )
                # If blockchain update is successful, commit local changes
                knowledge.content_hash = new_knowledge_hash # Update local hash
                knowledge.status = models.KnowledgeStatus.PENDING   # 状态变更为待验证
                db.add(
                    models.KnowledgeHistory(
                        knowledge_id=knowledge_id,
                        content_hash=old_knowledge_hash, # Record the old hash
                    )
                )
                db.add(knowledge)
                db.commit()
                db.refresh(knowledge)
                
                # 开启新的定时器，在投票结束后稍晚一点检查验证结果（秒）
                schedule_verification(knowledge.id, duration_sec + 2)
                
                return knowledge
            except Exception as e:
                logger.warning("更新知识上链失败，本地不更新，error: %s", e)
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"区块链更新失败: {e}")
        else:
            # Blockchain is not configured, but knowledge hash changed.
            # According to user's request, we should not update local DB.
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="知识内容已变更，但上链更新失败。本地数据库不予更新。"
            )

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