import os
from dataclasses import dataclass, field
from typing import List, Tuple, Optional
from dotenv import load_dotenv


# Ensure environment variables are loaded from backend/.env when running from project root
load_dotenv("backend/.env")


# class Settings (adicionar o campo handheld_classes)
@dataclass
class Settings:
    host: str = os.environ.get("HOST", "0.0.0.0")
    port: int = int(os.environ.get("PORT", "8000"))
    database_url: str = os.environ.get("DATABASE_URL", "sqlite:///./backend/data.db")
    cors_origins: List[str] = field(
        default_factory=lambda: os.environ.get(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001",
        ).split(",")
    )
    yolo_model: str = os.environ.get("YOLO_MODEL", "yolov8n.pt")
    conf_threshold: float = float(os.environ.get("CONF_THRESHOLD", "0.35"))
    iou_threshold: float = float(os.environ.get("IOU_THRESHOLD", "0.45"))
    # ROI rectangle (normalized 0-1): x1,y1,x2,y2
    roi_rect: Tuple[float, float, float, float] = (
        float(os.environ.get("ROI_X1", "0.25")),
        float(os.environ.get("ROI_Y1", "0.25")),
        float(os.environ.get("ROI_X2", "0.75")),
        float(os.environ.get("ROI_Y2", "0.75")),
    )
    qr_stop_text: str = os.environ.get("QR_STOP_TEXT", "STOP_APP")
    qr_stop_any: bool = os.environ.get("QR_STOP_ANY", "0").lower() in ("1", "true", "yes", "y")
    openai_api_key: Optional[str] = os.environ.get("OPENAI_API_KEY")
    handheld_classes: List[str] = field(
        default_factory=lambda: [s.strip() for s in os.environ.get(
            "HANDHELD_CLASSES",
            "bottle,cup,cell phone,remote,book,sports ball"
        ).split(",")]
    )


settings = Settings()