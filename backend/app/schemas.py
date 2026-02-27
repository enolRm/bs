from datetime import datetime
from typing import Optional, Union

from pydantic import BaseModel, Field, field_validator

from .models import KnowledgeStatus


class KnowledgeCreate(BaseModel):
    title: str = Field(..., max_length=255)
    content: str
    source: str = Field(..., min_length=1, description="知识来源，如 DOI、官方链接等")
    vote_duration: int = Field(60, description="投票时长数值")
    vote_unit: str = Field("s", description="投票时长单位: s, m, h, d")


class KnowledgeUpdate(BaseModel):
    """更新知识：均为可选，只更新提供的字段。"""
    title: Optional[str] = Field(None, max_length=255)
    content: Optional[str] = None
    source: Optional[str] = None
    vote_duration: Optional[int] = Field(None, description="投票时长数值")
    vote_unit: Optional[str] = Field(None, description="投票时长单位: s, m, h, d")


class KnowledgeHistoryOut(BaseModel):
    id: int
    knowledge_id: int
    title: Optional[str]
    content: Optional[str]
    content_hash: str
    source: Optional[str]
    operator: Optional[str]
    chain_id: Optional[str]
    status: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class KnowledgeOut(BaseModel):
    id: int
    chain_id: Optional[Union[str, int]]
    title: str
    content: str
    content_hash: str
    source: Optional[str]
    submitter_address: Optional[str]
    created_at: datetime
    voting_deadline: Optional[datetime]
    status: KnowledgeStatus
    verification_id: Optional[str] = None

    @field_validator("chain_id", mode="before")
    @classmethod
    def convert_chain_id_to_str(cls, v):
        if v is None:
            return None
        return str(v)

    class Config:
        from_attributes = True

