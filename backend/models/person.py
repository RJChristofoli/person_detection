from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, Text
from sqlalchemy.sql import func
from backend.models.base import Base


class Person(Base):
    __tablename__ = "people"

    id = Column(Integer, primary_key=True, index=True)
    track_id = Column(Integer, unique=True, index=True)
    first_seen = Column(DateTime(timezone=True), server_default=func.now())
    # last_seen deve ser preenchido explicitamente quando a pessoa sair do campo
    last_seen = Column(DateTime(timezone=True), nullable=True)
    top_color = Column(String, nullable=True)
    bottom_color = Column(String, nullable=True)
    last_action = Column(String, nullable=True)
    last_x = Column(Float, nullable=True)
    last_y = Column(Float, nullable=True)
    # Indicação de objetos próximos/segurados e sua descrição
    holding_object = Column(Boolean, nullable=True)
    object_description = Column(Text, nullable=True)