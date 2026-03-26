"""
Geopolitical Trader — FastAPI backend
"""
import asyncio
import json
import logging
import os
import re
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import (
    NewsItemDB, SignalDB, SubscriberDB, UserDB,
    create_tables, get_db,
)
from auth import create_access_token, get_current_user, hash_password, verify_password
from ml_engine import SignalEngine
from news_fetcher import fetch_all_feeds
from nlp_engine import GeopoliticalNLP

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger(__name__)

nlp = GeopoliticalNLP()
signal_engine = SignalEngine()

# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        message = json.dumps(data)
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()

# ---------------------------------------------------------------------------
# Background news processing
# ---------------------------------------------------------------------------

async def process_news(db: Session) -> int:
    articles = await fetch_all_feeds()
    new_signals = 0

    for article in articles:
        existing = db.query(NewsItemDB).filter_by(id=article["id"]).first()
        if existing:
            continue

        db_news = NewsItemDB(
            id=article["id"],
            title=article["title"],
            summary=article["summary"],
            url=article["url"],
            source=article["source"],
            published_at=article["published_at"],
        )
        db.add(db_news)

        try:
            analysis = nlp.analyze(article["title"], article["summary"])
            if analysis["event_type"] == "general":
                db.commit()
                continue

            signals = signal_engine.generate_signals(analysis, article["title"])
            if not signals:
                db.commit()
                continue

            db_signal = SignalDB(
                news_id=article["id"],
                news_title=article["title"],
                news_summary=article["summary"],
                news_url=article["url"],
                source=article["source"],
                published_at=article["published_at"],
                event_type=analysis["event_type"],
                event_label=analysis["event_label"],
                entities=analysis["entities"],
                sentiment=analysis["sentiment"],
                severity=analysis["severity"],
                severity_score=analysis["severity_score"],
                market_signals=signals,
            )
            db.add(db_signal)
            new_signals += 1
        except Exception as exc:
            logger.error("Signal generation failed for '%s': %s", article["title"], exc)

        db.commit()

    if new_signals:
        await manager.broadcast({"type": "new_signals", "count": new_signals})
        logger.info("Added %d new signals", new_signals)

    return new_signals


async def background_loop():
    from database import SessionLocal
    while True:
        db = SessionLocal()
        try:
            await process_news(db)
        except Exception as exc:
            logger.error("Background loop error: %s", exc)
        finally:
            db.close()
        await asyncio.sleep(300)  # refresh every 5 minutes


# ---------------------------------------------------------------------------
# App lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    task = asyncio.create_task(background_loop())
    yield
    task.cancel()


app = FastAPI(title="Geopolitical Trader API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class MarketSignal(BaseModel):
    asset: str
    asset_label: str
    category: str
    signal: str
    confidence: int
    reasoning: str


class SignalResponse(BaseModel):
    id: str
    news_title: str
    news_summary: Optional[str]
    news_url: Optional[str]
    source: str
    published_at: datetime
    event_type: str
    event_label: str
    entities: list[str]
    sentiment: float
    severity: str
    severity_score: float
    market_signals: list[dict]
    created_at: datetime


class SubscribeRequest(BaseModel):
    email: str
    name: Optional[str] = ""
    filters: Optional[dict] = {}


class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str


class StatsResponse(BaseModel):
    total_signals: int
    buy_signals: int
    sell_signals: int
    top_assets: list[dict]
    recent_sources: list[str]
    last_updated: Optional[datetime]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/api/auth/register", response_model=UserResponse, status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=422, detail="Invalid email address")
    if db.query(UserDB).filter_by(email=email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = UserDB(email=email, name=req.name.strip(), hashed_password=hash_password(req.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse(id=user.id, email=user.email, name=user.name)


@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    user = db.query(UserDB).filter_by(email=email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "email": user.email, "name": user.name}}


@app.get("/api/auth/me", response_model=UserResponse)
def me(current_user: UserDB = Depends(get_current_user)):
    return UserResponse(id=current_user.id, email=current_user.email, name=current_user.name)


@app.get("/api/signals", response_model=list[SignalResponse])
def get_signals(
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    signal_direction: Optional[str] = None,   # BUY or SELL
    asset_category: Optional[str] = None,
    source: Optional[str] = None,
    hours: int = 24,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    query = db.query(SignalDB).filter(SignalDB.created_at >= cutoff)

    if event_type:
        query = query.filter(SignalDB.event_type == event_type)
    if severity:
        query = query.filter(SignalDB.severity == severity.upper())
    if source:
        query = query.filter(SignalDB.source.ilike(f"%{source}%"))

    signals = query.order_by(SignalDB.published_at.desc()).limit(limit * 3).all()

    # Post-filter by signal direction / asset category (in-memory since stored as JSON)
    results = []
    for s in signals:
        ms = s.market_signals or []
        if signal_direction:
            ms = [m for m in ms if m.get("signal") == signal_direction.upper()]
        if asset_category:
            ms = [m for m in ms if m.get("category", "").lower() == asset_category.lower()]
        if not ms and (signal_direction or asset_category):
            continue

        results.append(SignalResponse(
            id=s.id,
            news_title=s.news_title,
            news_summary=s.news_summary,
            news_url=s.news_url,
            source=s.source,
            published_at=s.published_at,
            event_type=s.event_type,
            event_label=s.event_label,
            entities=s.entities or [],
            sentiment=s.sentiment,
            severity=s.severity,
            severity_score=s.severity_score,
            market_signals=ms,
            created_at=s.created_at,
        ))

        if len(results) >= limit:
            break

    return results


@app.get("/api/stats", response_model=StatsResponse)
def get_stats(hours: int = 24, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    signals = db.query(SignalDB).filter(SignalDB.created_at >= cutoff).all()

    buy_count = 0
    sell_count = 0
    asset_counts: dict[str, int] = {}
    sources: set[str] = set()

    for s in signals:
        sources.add(s.source)
        for ms in (s.market_signals or []):
            if ms.get("signal") == "BUY":
                buy_count += 1
            elif ms.get("signal") == "SELL":
                sell_count += 1
            asset = ms.get("asset_label", ms.get("asset", ""))
            asset_counts[asset] = asset_counts.get(asset, 0) + 1

    top_assets = [
        {"asset": k, "count": v}
        for k, v in sorted(asset_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    ]

    last_signal = db.query(SignalDB).order_by(SignalDB.created_at.desc()).first()

    return StatsResponse(
        total_signals=len(signals),
        buy_signals=buy_count,
        sell_signals=sell_count,
        top_assets=top_assets,
        recent_sources=list(sources)[:6],
        last_updated=last_signal.created_at if last_signal else None,
    )


@app.post("/api/subscribe", status_code=201)
def subscribe(req: SubscribeRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=422, detail="Invalid email address")

    existing = db.query(SubscriberDB).filter_by(email=email).first()
    if existing:
        existing.active = True
        db.commit()
        return {"message": "Email updated — you are subscribed for alerts."}

    subscriber = SubscriberDB(
        email=email,
        name=req.name or "",
        filters=req.filters or {},
    )
    db.add(subscriber)
    db.commit()
    return {"message": "Subscribed successfully. You will receive geopolitical trading alerts."}


@app.get("/api/sources")
def list_sources():
    from news_fetcher import RSS_FEEDS
    return [f["name"] for f in RSS_FEEDS]


@app.post("/api/refresh")
async def manual_refresh(db: Session = Depends(get_db)):
    count = await process_news(db)
    return {"new_signals": count, "message": f"Processed feeds. {count} new signals generated."}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep alive
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/api/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}


# ---------------------------------------------------------------------------
# Serve built React frontend (production).
# Must come LAST so API routes take priority.
# ---------------------------------------------------------------------------
_STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_STATIC_DIR):
    app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="frontend")