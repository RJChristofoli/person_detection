import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import settings
from backend.core.db import init_db
from backend.routers.detections import router as detections_router
from backend.routers.events import router as events_router
from backend.routers.chat import router as chat_router
from backend.routers.config_router import router as config_router
from backend.routers.qr import router as qr_router
from backend.routers.people import router as people_router


def create_app() -> FastAPI:
    app = FastAPI(title="Person Detection API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    init_db()

    app.include_router(detections_router, prefix="/api")
    app.include_router(events_router, prefix="/api")
    app.include_router(chat_router, prefix="/api")
    app.include_router(config_router, prefix="/api")
    app.include_router(people_router, prefix="/api")
    app.include_router(qr_router, prefix="/api")

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", settings.port))
    uvicorn.run("backend.main:app", host=settings.host, port=port, reload=True)