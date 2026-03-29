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

def split_text(text: str, chunk_size: int = 600, chunk_overlap: int = 100) -> list[str]:
    """
    简单的文本切分函数。
    支持按长度切分，并保留一定的重叠部分以保证上下文连贯。
    """
    if not text:
        return []
    
    # 如果文本较短，直接返回
    if len(text) <= chunk_size:
        return [text]
        
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        
        # 移动起始位置，考虑重叠
        start += (chunk_size - chunk_overlap)
        
        # 如果剩余部分不足以支撑一个新的有意义的 chunk，就停止
        if len(text) - start < 50: # 剩余太少则合并到最后一个或直接丢弃（此处选择停止）
            break
            
    return chunks

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

        # 从数据库获取 verify_id
        verify_id = knowledge.verification_id
        
        if not verify_id:
            logger.warning(f"知识 {knowledge_id} 数据库中缺少验证ID。")
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
            # 嵌入知识并加入向量库（支持切片以提高检索效果）
            if knowledge.content and knowledge.content.strip():
                try:
                    # 1. 清理旧向量
                    try:
                        # 删除该知识 ID 下的所有切片
                        vector_store.delete_by_metadata({"db_id": str(knowledge.id)})
                        if knowledge.chain_id:
                            # 兼容旧版本以 chain_id 作为 metadata 的删除
                            vector_store.delete_by_metadata({"chain_id": str(knowledge.chain_id)})
                            # 同时也尝试按 ID 删一下（兼容旧版本只存了一个 ID 的情况）
                            vector_store.delete_documents(ids=[str(knowledge.chain_id)])
                    except Exception:
                        pass

                    # 2. 切片
                    # 拼接标题和正文用于向量化
                    text_to_split = f"{knowledge.title}\n{knowledge.content}" if knowledge.title else knowledge.content
                    chunks = split_text(text_to_split)
                    
                    if not chunks:
                        chunks = [text_to_split]

                    # 3. 批量嵌入
                    embeddings = embed_texts(chunks)
                    
                    # 4. 批量存入
                    chunk_ids = [f"{knowledge.id}_chunk_{i}" for i in range(len(chunks))]
                    metadatas = [
                        {
                            "db_id": str(knowledge.id),
                            "chain_id": str(knowledge.chain_id),
                            "title": knowledge.title,
                            "source": knowledge.source,
                            "chunk_index": i
                        } for i in range(len(chunks))
                    ]
                    
                    vector_store.add_documents(
                        ids=chunk_ids,
                        embeddings=embeddings,
                        metadatas=metadatas,
                        documents=chunks,
                    )
                    logger.info(f"知识 {knowledge_id} 已验证并切分为 {len(chunks)} 个块加入向量库。")
                except Exception as e:
                    logger.error(f"知识 {knowledge_id} 向量化和切片存入失败: {e}")
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
