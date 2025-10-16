from pydantic import BaseModel
from typing import List, Optional


class DetectionItem(BaseModel):
    track_id: int
    bbox: List[int]  # [x1, y1, x2, y2]
    confidence: float
    top_color: Optional[str] = None
    bottom_color: Optional[str] = None
    action: Optional[str] = None
    objects: List[str] = []


class EventOut(BaseModel):
    id: int
    timestamp: str
    event_type: str
    track_id: int
    roi_name: str | None
    details: str | None


class PersonOut(BaseModel):
    id: int
    track_id: int
    first_seen: str
    last_seen: str | None
    top_color: str | None
    bottom_color: str | None
    last_action: str | None
    holding_object: bool | None = None
    object_description: str | None = None