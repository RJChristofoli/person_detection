import os
from typing import List
from openai import OpenAI
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.models.event import Event
from backend.models.person import Person
from backend.schemas.common import DetectionItem


def _build_context(db: Session) -> str:
    people = db.query(Person).all()
    events = db.query(Event).order_by(Event.timestamp.asc()).all()
    context = [
        f"People count: {len(people)}",
    ]
    for p in people:
        context.append(
            f"Person track {p.track_id}: top_color={p.top_color}, bottom_color={p.bottom_color}, last_action={p.last_action}"
        )
    context.append("Events:")
    for e in events:
        context.append(
            f"{e.timestamp} type={e.event_type} track={e.track_id} details={e.details}"
        )
    return "\n".join(context)


def ask_llm(db: Session, message: str) -> str:
    if not settings.openai_api_key:
        return "OPENAI_API_KEY não definido. Configure para habilitar o chat."

    client = OpenAI(api_key=settings.openai_api_key)
    system_prompt = (
        "Você é um assistente que responde perguntas sobre eventos e pessoas detectadas. "
        "Use o contexto factual abaixo para responder com precisão."
    )
    ctx = _build_context(db)

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Contexto:\n{ctx}\n\nPergunta: {message}"},
        ],
        temperature=0,
    )
    return completion.choices[0].message.content