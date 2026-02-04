from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .models import KnowledgeStatus


class KnowledgeCreate(BaseModel):
    title: str = Field(..., max_length=255)
    content: str
    source: Optional[str] = None


class KnowledgeUpdate(BaseModel):
    """更新知识：均为可选，只更新提供的字段。"""
    title: Optional[str] = Field(None, max_length=255)
    content: Optional[str] = None
    source: Optional[str] = None


class KnowledgeHistoryOut(BaseModel):
    content_hash: str
    created_at: datetime

    class Config:
        from_attributes = True


class KnowledgeOut(BaseModel):
    id: int
    chain_id: Optional[int]
    title: str
    content: str
    content_hash: str
    source: Optional[str]
    submitter_address: Optional[str]
    created_at: datetime
    status: KnowledgeStatus

    class Config:
        from_attributes = True

