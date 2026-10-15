from __future__ import annotations

from datetime import date

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


AIRequestMode = Literal["chat", "photo_analysis"]


class DailyTaskRequest(BaseModel):
    language: Literal["zh-TW", "en"] = "zh-TW"
    date: date


class DailyTaskResponse(BaseModel):
    date: date
    tasks: List[str] = Field(min_length=3, max_length=3)


class DailyTaskFeedbackResponse(BaseModel):
    feedback: str = Field(min_length=1, max_length=300)


class SpacePoint(BaseModel):
    x: float = Field(ge=0, le=1, allow_inf_nan=False)
    y: float = Field(ge=0, le=1, allow_inf_nan=False)

class SpaceRegion(BaseModel):
    id: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=60)
    kind: Literal['floor', 'wall', 'doorway', 'workspace', 'storage', 'other']
    polygon: List[SpacePoint] = Field(min_length=3, max_length=12)
    observation: str = Field(max_length=250)

class StorageUnit(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    region_id: str = Field(min_length=1, max_length=30)
    observation: str = Field(max_length=250)

class SpaceAnalysis(BaseModel):
    room_type: str = Field(max_length=60)
    summary: str = Field(max_length=500)
    regions: List[SpaceRegion] = Field(default_factory=list, max_length=12)
    storage_units: List[StorageUnit] = Field(default_factory=list, max_length=12)
    circulation: List[str] = Field(default_factory=list, max_length=12)
    limitations: List[str] = Field(default_factory=list, max_length=12)
    overlay_uri: Optional[str] = Field(default=None, max_length=2000000)

class StoragePreferences(BaseModel):
    visual_preference: Optional[Literal['rich', 'minimal']] = None
    detail_preference: Optional[Literal['simple', 'detailed']] = None
    notes: str = Field(default='', max_length=500)

class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=1200)

class ChatRequest(BaseModel):
    language: Literal["zh-TW", "en"] = "zh-TW"
    history: List[ChatTurn] = Field(default_factory=list, max_length=8)
    message: str
    space_analysis: Optional[SpaceAnalysis] = None
    storage_preferences: Optional[StoragePreferences] = None
    user_persona: Optional[str] = None
    user_profile: Optional[Dict[str, Any]] = None
    items: List[Dict[str, Any]] = Field(default_factory=list)

    # chat：一般聊天
    # photo_analysis：照片辨識後的收納分析
    mode: AIRequestMode = "chat"


class KnowledgeSource(BaseModel):
    title: str
    url: str
    source_label: str


class ChatResponse(BaseModel):
    retrieved_sources: List[KnowledgeSource] = Field(default_factory=list)
    notice: str = ''
    reply: str
    retrieved_titles: List[str] = Field(default_factory=list)


class DetectedItem(BaseModel):
    name: str
    category: str
    count: int
    confidence: Optional[float] = None
    raw_label: Optional[str] = None


class DetectionBox(BaseModel):
    source: Optional[Literal['model', 'gemini', 'combined']] = None
    name: str
    category: str
    confidence: Optional[float] = None
    raw_label: Optional[str] = None
    x: float
    y: float
    width: float
    height: float


class DetectItemsResponse(BaseModel):
    space_analysis: Optional[SpaceAnalysis] = None
    space_status: Literal['completed', 'unavailable'] = 'unavailable'
    space_notice: str = ''
    ai_status: Literal['completed', 'unavailable'] = 'unavailable'
    notice: str = ''
    detected_items: List[DetectedItem] = Field(default_factory=list)
    detection_boxes: List[DetectionBox] = Field(default_factory=list)
    total_detections: int
    model_name: str
