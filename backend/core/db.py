from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.core.config import settings
from backend.models.base import Base


engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    # Cria tabelas se não existirem
    Base.metadata.create_all(bind=engine)

    # Migração simples em tempo de execução para novos campos em people
    # Evita necessidade de ferramenta de migração neste projeto simples
    # Em SQLAlchemy 2.x devemos usar exec_driver_sql para SQL literal
    with engine.begin() as conn:
        # SQLite: PRAGMA table_info retorna colunas existentes
        cols = conn.exec_driver_sql("PRAGMA table_info(people)").fetchall()
        col_names = {c[1] for c in cols}  # c[1] é o nome da coluna

        if "holding_object" not in col_names:
            conn.exec_driver_sql("ALTER TABLE people ADD COLUMN holding_object INTEGER")
        if "object_description" not in col_names:
            conn.exec_driver_sql("ALTER TABLE people ADD COLUMN object_description TEXT")