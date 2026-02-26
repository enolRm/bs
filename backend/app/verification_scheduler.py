import threading
import time
import logging
import json
from typing import Dict, Optional

from sqlalchemy.orm import Session

from .db import SessionLocal
from . import models
from .models import Knowledge, KnowledgeStatus
from .config import settings
from .blockchain import get_blockchain_client
from .embeddings import embed_texts
from .vector_store import vector_store

logger = logging.getLogger(__name__)

# 全局定时器字典: knowledge_id -> Timer
_timers: Dict[int, threading.Timer] = {}
_timers_lock = threading.Lock()

def schedule_verification(knowledge_id: int, delay: int = 300):
    """
    为指定知识ID安排一次验证任务。
    如果已有正在等待的任务，会先取消它。
    默认延迟 300 秒 (5分钟)。
    """
    cancel_verification(knowledge_id)
    
    with _timers_lock:
        timer = threading.Timer(delay, _run_verification_task, args=[knowledge_id])
        _timers[knowledge_id] = timer
        timer.start()
        logger.info(f"已安排知识 {knowledge_id} 的验证任务，将在 {delay} 秒后执行。")

def cancel_verification(knowledge_id: int):
    """
    取消指定知识ID的验证任务。
    """
    with _timers_lock:
        if knowledge_id in _timers:
            timer = _timers[knowledge_id]
            timer.cancel()
            del _timers[knowledge_id]
            logger.info(f"已取消知识 {knowledge_id} 的验证任务。")

def _run_verification_task(knowledge_id: int):
    """
    定时器触发的任务函数：执行链上验证逻辑。
    """
    # 任务执行时，从字典中移除（虽然已经不需要 cancel 了，但为了清理）
    with _timers_lock:
        if knowledge_id in _timers:
            del _timers[knowledge_id]
            
    logger.info(f"开始执行知识 {knowledge_id} 的链上验证检查...")
    
    db: Session = SessionLocal()
    try:
        verify_knowledge_logic(db, knowledge_id)
    except Exception as e:
        logger.error(f"执行知识 {knowledge_id} 验证任务时发生错误: {e}")
    finally:
        db.close()

def verify_knowledge_logic(db: Session, knowledge_id: int):
    """
    核心验证逻辑
    """
    if not settings.TBAAS_SECRET_ID or not settings.TBAAS_SECRET_KEY:
        logger.warning("未配置 TBAAS_SECRET_ID / TBAAS_SECRET_KEY，无法进行链上验证。")
        return

    knowledge = db.query(Knowledge).filter(Knowledge.id == knowledge_id).first()
    if not knowledge:
        logger.warning(f"知识 {knowledge_id} 不存在，跳过验证。")
        return
    
    # 这里我们默认处理 PENDING 状态（后续根据需求处理 REJECTED）
    if knowledge.status == KnowledgeStatus.VERIFIED:
        logger.info(f"知识 {knowledge_id} 已经是 VERIFIED 状态，跳过验证。")
        return

    if not knowledge.chain_id:
        logger.warning(f"知识 {knowledge_id} 未上链，无法验证。")
        return

    try:
        client = get_blockchain_client()

        # 查询链上知识获取 verify_id
        # 注意：chain_id 可能是字符串或数字，根据现有代码它是 str(knowledge.id)
        chain_knowledge_str = client.query_knowledge_by_id(str(knowledge.chain_id))
        chain_knowledge = json.loads(chain_knowledge_str)
        verify_id = chain_knowledge.get("verification_id")
        
        if not verify_id:
            logger.warning(f"知识 {knowledge_id} 无法获取链上验证ID。")
            return

        # 调用链上合约判断定稿结果
        result_str = client.judge_verification_result(
            verify_id=verify_id,
            current_time_ms=int(time.time() * 1000),
        )
        
        logger.info(f"知识 {knowledge_id} 链上验证结果: {result_str}")

        # 根据 contract.go: 1 是 Approved (Verified), 2 是 Rejected
        # 判断 result_str 中是否包含对应的状态数字
        if "1" in result_str:
            knowledge.status = KnowledgeStatus.VERIFIED
            # 嵌入知识并加入向量库
            if knowledge.content and knowledge.content.strip():
                try:
                    embedding = embed_texts([knowledge.content])[0]
                    vector_store.add_documents(
                        ids=[str(knowledge.id)],
                        embeddings=[embedding],
                        metadatas=[
                            {
                                "db_id": str(knowledge.id),
                                "title": knowledge.title,
                                "source": knowledge.source,
                            }
                        ],
                        documents=[knowledge.content],
                    )
                    logger.info(f"知识 {knowledge_id} 已验证并加入向量库。")
                except Exception as e:
                    logger.error(f"知识 {knowledge_id} 向量化失败: {e}")
            else:
                logger.warning(f"知识 {knowledge_id} 内容为空，无法嵌入。")
        elif "2" in result_str:
            knowledge.status = KnowledgeStatus.REJECTED
            logger.info(f"知识 {knowledge_id} 已被拒绝。")
        else:
            logger.info(f"知识 {knowledge_id} 尚未定稿 (Result: {result_str})。")

        db.add(knowledge)
        db.commit()
        db.refresh(knowledge)
        
    except Exception as e:
        logger.error(f"验证逻辑执行出错: {e}")
        db.rollback()
