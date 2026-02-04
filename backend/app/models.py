from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Column, Integer, String, DateTime, Enum, Text, ForeignKey

from .db import Base


class KnowledgeStatus(str, PyEnum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class Knowledge(Base):
    __tablename__ = "knowledge"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    chain_id = Column(Integer, index=True, nullable=True)  # 对应链上 id
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    content_hash = Column(String(255), nullable=False)
    source = Column(String(255), nullable=True)
    submitter_address = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(Enum(KnowledgeStatus), default=KnowledgeStatus.PENDING)


class KnowledgeHistory(Base):
    """知识更新历史：每次更新前将当时的内容哈希写入，用于追溯。"""
    __tablename__ = "knowledge_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    knowledge_id = Column(Integer, ForeignKey("knowledge.id"), nullable=False, index=True)
    content_hash = Column(String(255), nullable=False)  # 更新前的内容哈希
    created_at = Column(DateTime, default=datetime.utcnow)

