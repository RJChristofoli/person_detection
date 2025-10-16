from datetime import datetime
from typing import Optional, Dict
from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.core.db import SessionLocal
from backend.models.person import Person
from backend.schemas.stats import StatsOut, TimeSeriesOut


router = APIRouter(prefix="/stats", tags=["stats"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=StatsOut)
def get_stats(
    color: Optional[str] = None,
    action: Optional[str] = None,            # "walking" | "standing"
    holding_object: Optional[bool] = None,   # true | false
    time_from: Optional[str] = None,         # ISO string
    time_to: Optional[str] = None,           # ISO string
    db: Session = Depends(get_db),
):
    q = db.query(Person)

    # Filtros (mesma semântica da UI)
    if color:
        q = q.filter(or_(Person.top_color == color, Person.bottom_color == color))
    if action:
        # "standing" na UI é "stopped" no banco
        action_db = "stopped" if action.lower() == "standing" else action.lower()
        q = q.filter(Person.last_action == action_db)
    if holding_object is not None:
        q = q.filter(Person.holding_object == holding_object)
    if time_from:
        try:
            start_dt = datetime.fromisoformat(time_from)
            q = q.filter(Person.first_seen >= start_dt)
        except Exception:
            pass
    if time_to:
        try:
            end_dt = datetime.fromisoformat(time_to)
            q = q.filter(Person.first_seen <= end_dt)
        except Exception:
            pass

    rows = q.all()

    # Agregações
    total = len(rows)
    actions_count: Dict[str, int] = {"walking": 0, "standing": 0}
    colors_count: Dict[str, int] = {}
    holding_count = 0
    active_in_frame = 0
    total_seconds = 0
    finished_sessions = 0

    buckets: Dict[str, int] = {}

    for p in rows:
        # Actions
        if p.last_action == "walking":
            actions_count["walking"] += 1
        elif p.last_action == "stopped":
            actions_count["standing"] += 1

        # Colors: somar top e bottom (ignorando None/unknown)
        for c in (p.top_color, p.bottom_color):
            if c and c.strip() and c.strip().lower() != "unknown":
                colors_count[c] = (colors_count.get(c, 0) + 1)

        # Holding
        if bool(p.holding_object):
            holding_count += 1

        # Active in frame: sem last_seen
        if p.last_seen is None:
            active_in_frame += 1

        # Tempo médio (first_seen -> last_seen)
        if p.first_seen and p.last_seen:
            start = p.first_seen.timestamp()
            end = p.last_seen.timestamp()
            if end >= start:
                total_seconds += int(round(end - start))
                finished_sessions += 1

        # Série temporal: por minuto com base no first_seen
        if p.first_seen:
            label = p.first_seen.strftime("%Y-%m-%d %H:%M")
            buckets[label] = (buckets.get(label, 0) + 1)

    avg_time = int(round(total_seconds / finished_sessions)) if finished_sessions > 0 else 0
    labels = sorted(buckets.keys())
    data = [buckets[l] for l in labels]

    return StatsOut(
        total=total,
        activeInFrame=active_in_frame,
        holdingCount=holding_count,
        avgTime=avg_time,
        actionsCount=actions_count,
        colorsCount=colors_count,
        timeSeries=TimeSeriesOut(labels=labels, data=data),
    )