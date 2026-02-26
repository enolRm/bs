import json
import logging
import time
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..embeddings import embed_texts
from ..models import Knowledge, KnowledgeStatus
from ..vector_store import vector_store
from ..config import settings
from ..blockchain import get_blockchain_client
from ..verification_scheduler import verify_knowledge_logic

router = APIRouter(prefix="/verification", tags=["verification"])
logger = logging.getLogger(__name__)


@router.post("/{knowledge_id}/vote", summary="链上投票（演示用：后端代签名）")
def vote_knowledge_onchain(
    knowledge_id: int,
    body: dict,
    db: Session = Depends(get_db)
) -> dict:
    """
    链上投票接口（演示用）：
    - body: {"support": true/false, "voter": "voter_address", "voter_role": 0/1/2}
    """
    if not settings.TBAAS_SECRET_ID or not settings.TBAAS_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未配置 TBAAS_SECRET_ID / TBAAS_SECRET_KEY，无法由后端代签名发起链上投票。",
        )

    support = bool(body.get("support", True))
    voter = body.get("voter", "TODO: 1") # TODO: 替换为实际投票者
    voter_role = int(body.get("voter_role", 0)) # 0: Normal, 1: Expert, 2: Admin

    client = get_blockchain_client()
    # 需要先查询知识获取 verify_id
    knowledge = db.query(Knowledge).filter(Knowledge.id == knowledge_id).first()
    if not knowledge or not knowledge.chain_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识不存在或未上链")

    # 查询链上知识获取 verify_id
    chain_knowledge_str = client.query_knowledge_by_id(str(knowledge.chain_id))
    chain_knowledge = json.loads(chain_knowledge_str)
    verify_id = chain_knowledge.get("verification_id")
    if not verify_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无法获取链上知识的验证ID")

    time.sleep(1)  # 等待1秒

    try:
        tx_hash = client.cast_vote(
            verify_id=verify_id,
            voter=voter,
            vote_type=1 if support else 0,
            voter_role=voter_role,
            current_time_ms=int(time.time() * 1000),
        )
    except Exception as e:
        if "vote is not in valid time range" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="投票时间不在有效范围内，无法进行投票。",
            )
        raise e
    return {"tx_hash": tx_hash}


@router.post("/{knowledge_id}/finalize-onchain", summary="链上知识定稿（演示用：后端代签名）")
def finalize_knowledge_onchain(
    knowledge_id: int,
    db: Session = Depends(get_db),
) -> schemas.KnowledgeOut:
    """
    链上知识定稿接口（演示用）：
    - 调用链上合约的 judgeVerificationResult 方法，根据链上结果更新本地知识状态
    """
    if not settings.TBAAS_SECRET_ID or not settings.TBAAS_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未配置 TBAAS_SECRET_ID / TBAAS_SECRET_KEY，无法由后端代签名发起链上定稿。",
        )

    knowledge = db.query(Knowledge).filter(Knowledge.id == knowledge_id).first()
    if not knowledge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识不存在")
    
    # 复用验证逻辑
    verify_knowledge_logic(db, knowledge_id)
    
    # 重新获取最新状态
    db.refresh(knowledge)
    return knowledge