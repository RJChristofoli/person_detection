from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.core.db import SessionLocal
from backend.models.event import Event
from backend.schemas.common import EventOut


router = APIRouter(prefix="/events", tags=["events"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=List[EventOut])
def list_events(
    event_type: Optional[str] = None,
    track_id: Optional[int] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Event)
    if event_type:
        q = q.filter(Event.event_type == event_type)
    if track_id:
        q = q.filter(Event.track_id == track_id)
    if start:
        q = q.filter(Event.timestamp >= datetime.fromisoformat(start))
    if end:
        q = q.filter(Event.timestamp <= datetime.fromisoformat(end))
    rows = q.order_by(Event.timestamp.desc()).all()
    return [
        EventOut(
            id=r.id,
            timestamp=r.timestamp.isoformat(),
            event_type=r.event_type,
            track_id=r.track_id,
            roi_name=r.roi_name,
            details=r.details,
        )
        for r in rows
    ]