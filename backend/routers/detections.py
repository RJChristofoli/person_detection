from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from typing import List

from backend.schemas.common import DetectionItem
from backend.services.detection_service import detection_service


router = APIRouter(prefix="/detections", tags=["detections"])


@router.post("/start")
def start_camera():
    detection_service.start(0)
    return {"status": "started"}


@router.post("/stop")
def stop_camera():
    detection_service.stop()
    return {"status": "stopped", "stopped_by_qr": detection_service.stopped_by_qr}


@router.get("/stream")
def stream():
    return StreamingResponse(
        detection_service.gen_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.get("/current", response_model=List[DetectionItem])
def current():
    return detection_service.get_detections()


@router.get("/status")
def status():
    return {"running": detection_service.running, "stopped_by_qr": detection_service.stopped_by_qr}