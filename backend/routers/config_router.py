from fastapi import APIRouter
from pydantic import BaseModel

from backend.core.config import settings


router = APIRouter(prefix="/config", tags=["config"])


class ConfigIn(BaseModel):
    roi_rect: tuple[float, float, float, float] | None = None
    qr_stop_text: str | None = None
    qr_stop_any: bool | None = None
    conf_threshold: float | None = None
    iou_threshold: float | None = None
    handheld_classes: list[str] | None = None


@router.get("/")
def get_config():
    return {
        "roi_rect": settings.roi_rect,
        "qr_stop_text": settings.qr_stop_text,
        "qr_stop_any": settings.qr_stop_any,
        "conf_threshold": settings.conf_threshold,
        "iou_threshold": settings.iou_threshold,
        "handheld_classes": settings.handheld_classes,
    }


@router.post("/")
def update_config(body: ConfigIn):
    if body.roi_rect:
        settings.roi_rect = body.roi_rect
    if body.qr_stop_text:
        settings.qr_stop_text = body.qr_stop_text
    if body.qr_stop_any is not None:
        settings.qr_stop_any = body.qr_stop_any
    if body.conf_threshold is not None:
        settings.conf_threshold = body.conf_threshold
    if body.iou_threshold is not None:
        settings.iou_threshold = body.iou_threshold
    if body.handheld_classes is not None:
        settings.handheld_classes = body.handheld_classes
    return get_config()