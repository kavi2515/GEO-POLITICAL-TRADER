from sqlalchemy import create_engine, Column, String, Float, Integer, DateTime, Text, Boolean, JSON
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from datetime import datetime
import uuid

SQLALCHEMY_DATABASE_URL = "sqlite:///./geopolitical_trader.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class NewsItemDB(Base):
    __tablename__ = "news_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    summary = Column(Text)
    url = Column(String)
    source = Column(String)
    published_at = Column(DateTime, default=datetime.utcnow)
    processed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class SignalDB(Base):
    __tablename__ = "signals"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    news_id = Column(String)
    news_title = Column(String)
    news_summary = Column(Text)
    news_url = Column(String)
    source = Column(String)
    published_at = Column(DateTime, default=datetime.utcnow)
    event_type = Column(String)
    event_label = Column(String)
    entities = Column(JSON)          # list of country/region names
    sentiment = Column(Float)        # -1.0 to 1.0
    severity = Column(String)        # LOW / MEDIUM / HIGH / CRITICAL
    severity_score = Column(Float)   # 0.0 to 1.0
    market_signals = Column(JSON)    # list of {asset, signal, confidence, reasoning}
    emailed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class SubscriberDB(Base):
    __tablename__ = "subscribers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False)
    name = Column(String)
    filters = Column(JSON)   # {regions: [], asset_classes: [], min_confidence: int}
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class PortfolioDB(Base):
    __tablename__ = "portfolio"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False)
    signal_id = Column(String, nullable=False)
    news_title = Column(String, nullable=False)
    asset = Column(String, nullable=False)
    asset_label = Column(String, nullable=False)
    category = Column(String)
    direction = Column(String, nullable=False)  # BUY or SELL
    confidence = Column(Integer)
    entry_price = Column(Float, nullable=True)
    notes = Column(String, nullable=True)
    status = Column(String, default="OPEN")  # OPEN or CLOSED
    created_at = Column(DateTime, default=datetime.utcnow)


class UserDB(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


def create_tables():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
