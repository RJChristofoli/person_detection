from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.core.db import SessionLocal
from backend.models.person import Person
from backend.schemas.common import PersonOut


router = APIRouter(prefix="/people", tags=["people"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=List[PersonOut])
def list_people(db: Session = Depends(get_db)):
    rows = db.query(Person).all()
    result = []
    for p in rows:
        result.append(
            PersonOut(
                id=p.id,
                track_id=p.track_id,
                first_seen=p.first_seen.isoformat() if p.first_seen else "",
                last_seen=p.last_seen.isoformat() if p.last_seen else None,
                top_color=p.top_color,
                bottom_color=p.bottom_color,
                last_action=p.last_action,
                holding_object=p.holding_object,
                object_description=p.object_description,
            )
        )
    return result