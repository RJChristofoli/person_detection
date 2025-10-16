import os
from typing import List
from openai import OpenAI
from sqlalchemy.orm import Session
from collections import Counter
from backend.core.config import settings
from backend.models.event import Event
from backend.models.person import Person
from backend.schemas.common import DetectionItem

def _build_context(db: Session) -> str:
    people = db.query(Person).all()
    events = db.query(Event).order_by(Event.timestamp.asc()).all()

    # Agregado de objetos
    obj_counter = Counter()
    holding_count = 0
    for p in people:
        if bool(p.holding_object):
            holding_count += 1
        if p.object_description:
            for o in [s.strip().lower() for s in p.object_description.split(",") if s.strip()]:
                obj_counter[o] += 1

    context = [
        f"People count: {len(people)}",
        f"Holding objects: {holding_count}",
        f"Allowed object classes: {', '.join(settings.handheld_classes)}",
    ]
    for p in people:
        context.append(
            f"Person track {p.track_id}: top_color={p.top_color}, bottom_color={p.bottom_color}, last_action={p.last_action}, holding_object={bool(p.holding_object)}, objects={p.object_description or ''}"
        )
    context.append("Events:")
    for e in events:
        context.append(
            f"{e.timestamp} type={e.event_type} track={e.track_id} details={e.details}"
        )
    if obj_counter:
        summary = ", ".join([f"{k}={obj_counter[k]}" for k in sorted(obj_counter.keys())])
        context.append(f"Objects summary: {summary}")
    return "\n".join(context)

def ask_llm(db: Session, message: str) -> str:
    if not settings.openai_api_key:
        return "OPENAI_API_KEY não definido. Configure para habilitar o chat."

    client = OpenAI(api_key=settings.openai_api_key)
    system_prompt = (
        "Você é um assistente que responde perguntas sobre eventos, pessoas e objetos detectados. "
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