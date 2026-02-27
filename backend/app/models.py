from datetime import datetime, timezone
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
    chain_id = Column(String(255), index=True, nullable=True)  # 对应链上 id
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    content_hash = Column(String(255), nullable=False)
    source = Column(String(255), nullable=True)
    submitter_address = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    voting_deadline = Column(DateTime(timezone=True), nullable=True)  # 投票截止时间
    status = Column(Enum(KnowledgeStatus), default=KnowledgeStatus.PENDING)
    verification_id = Column(String(255), nullable=True)  # 关联验证ID


class KnowledgeHistory(Base):
    """知识更新历史：每次更新前将当时的内容哈希写入，用于追溯。"""
    __tablename__ = "knowledge_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    knowledge_id = Column(Integer, ForeignKey("knowledge.id"), nullable=False, index=True)
    title = Column(String(255), nullable=True)
    content = Column(Text, nullable=True)
    content_hash = Column(String(255), nullable=False)  # 更新前的内容哈希
    source = Column(String(255), nullable=True)
    operator = Column(String(64), nullable=True)
    chain_id = Column(String(255), nullable=True)
    status = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Vote(Base):
    __tablename__ = "votes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    content_hash = Column(String(255), index=True, nullable=False) # 关联内容哈希
    voter = Column(String(64), nullable=False)
    support = Column(Integer, nullable=False)  # 1 for agree, 0 for disagree
    voter_role = Column(Integer, default=0)    # 0: Normal, 1: Expert, 2: Admin
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

