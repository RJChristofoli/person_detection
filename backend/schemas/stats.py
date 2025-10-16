from typing import Dict, List
from pydantic import BaseModel


class TimeSeriesOut(BaseModel):
    labels: List[str]
    data: List[int]


class StatsOut(BaseModel):
    # Mesmas chaves usadas pela dashboard atual
    total: int
    activeInFrame: int
    holdingCount: int
    avgTime: int  # segundos
    actionsCount: Dict[str, int]  # {"walking": X, "standing": Y}
    colorsCount: Dict[str, int]   # {"red": 3, "blue": 5, ...}
    timeSeries: TimeSeriesOut