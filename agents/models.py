from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class RequestStatus(str, Enum):
    NEW = "NEW"
    FOUND = "FOUND"
    NEGOTIATING = "NEGOTIATING"
    AGREED = "AGREED"
    PAID = "PAID"
    RETRY_SEARCH = "RETRY_SEARCH"


class NegotiationLogEntry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    agent: str
    message: str
    price: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


class FoundItem(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class Request(BaseModel):
    _id: Optional[str] = Field(None, alias="_id")
    status: RequestStatus = RequestStatus.NEW
    budget: float = Field(gt=0)
    target_image_url: str
    voyage_embedding: List[float] = Field(default_factory=list)
    found_item: Optional[FoundItem] = None
    negotiation_log: List[NegotiationLogEntry] = Field(default_factory=list)
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
