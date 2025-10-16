from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.core.db import SessionLocal
from backend.services.chat_service import ask_llm


router = APIRouter(prefix="/chat", tags=["chat"])


class ChatIn(BaseModel):
    message: str


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/")
def chat(body: ChatIn, db: Session = Depends(get_db)):
    answer = ask_llm(db, body.message)
    return {"answer": answer}