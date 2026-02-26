from datetime import datetime
from typing import Optional, Union

from pydantic import BaseModel, Field, field_validator

from .models import KnowledgeStatus


class KnowledgeCreate(BaseModel):
    title: str = Field(..., max_length=255)
    content: str
    source: Optional[str] = None
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
    content_hash: str
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

    @field_validator("chain_id", mode="before")
    @classmethod
    def convert_chain_id_to_str(cls, v):
        if v is None:
            return None
        return str(v)

    class Config:
        from_attributes = True

