from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..config import settings
from ..blockchain import get_blockchain_client
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
    - 调用 DeepSeek embedding 生成向量
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


@router.post("/{knowledge_id}/vote", summary="链上投票（演示用：后端代签名）")
def vote_knowledge_onchain(
    knowledge_id: int,
    body: dict,
) -> dict:
    """
    链上投票接口（演示用）：
    - 需要在 backend/.env 配置 CHAIN_SENDER_ADDRESS 与 CHAIN_SENDER_PRIVATE_KEY
    - body: {"support": true/false}
    """
    if not settings.CHAIN_SENDER_ADDRESS or not settings.CHAIN_SENDER_PRIVATE_KEY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未配置 CHAIN_SENDER_ADDRESS / CHAIN_SENDER_PRIVATE_KEY，无法由后端代签名发起链上投票。",
        )

    support = bool(body.get("support", True))
    client = get_blockchain_client()
    tx_hash = client.vote_knowledge(
        knowledge_id=knowledge_id,
        support=support,
        from_address=settings.CHAIN_SENDER_ADDRESS,
        private_key=settings.CHAIN_SENDER_PRIVATE_KEY,
    )
    return {"tx_hash": tx_hash}


@router.post("/{knowledge_id}/finalize", summary="链上终局判定（finalize）")
def finalize_knowledge_onchain(
    knowledge_id: int,
) -> dict:
    """
    链上 finalize（演示用）：
    - 需要在 backend/.env 配置 CHAIN_SENDER_ADDRESS 与 CHAIN_SENDER_PRIVATE_KEY
    """
    if not settings.CHAIN_SENDER_ADDRESS or not settings.CHAIN_SENDER_PRIVATE_KEY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未配置 CHAIN_SENDER_ADDRESS / CHAIN_SENDER_PRIVATE_KEY，无法由后端代签名发起 finalize。",
        )

    client = get_blockchain_client()
    tx_hash = client.finalize_knowledge(
        knowledge_id=knowledge_id,
        from_address=settings.CHAIN_SENDER_ADDRESS,
        private_key=settings.CHAIN_SENDER_PRIVATE_KEY,
    )
    return {"tx_hash": tx_hash}


@router.post("/{knowledge_id}/sync-status", response_model=KnowledgeOut, summary="从链上同步状态到本地并联动入库")
async def sync_status_from_chain(
    knowledge_id: int,
    db: Session = Depends(get_db),
) -> KnowledgeOut:
    """
    从链上读取状态，同步到本地 Knowledge.status。
    - 若链上已 Verified：将本地置为 VERIFIED，并确保入向量库
    - 若链上已 Rejected：将本地置为 REJECTED
    """
    k: Knowledge | None = db.query(Knowledge).filter(Knowledge.id == knowledge_id).first()
    if not k:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识不存在")

    if not k.chain_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该知识未绑定 chain_id，无法同步链上状态")

    client = get_blockchain_client()
    chain_status = client.get_knowledge_status(int(k.chain_id))

    if chain_status == 1:  # Verified
        k.status = KnowledgeStatus.VERIFIED
        db.add(k)
        db.commit()
        db.refresh(k)

        # 入向量库（幂等性由 Chroma id 控制；重复 add 可能报重复，这里先简单处理）
        embedding = embed_texts([k.content])[0]
        try:
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
        except Exception:
            # 已存在时忽略
            pass

    elif chain_status == 2:  # Rejected
        k.status = KnowledgeStatus.REJECTED
        db.add(k)
        db.commit()
        db.refresh(k)
    else:
        k.status = KnowledgeStatus.PENDING
        db.add(k)
        db.commit()
        db.refresh(k)

    return KnowledgeOut.from_orm(k)

