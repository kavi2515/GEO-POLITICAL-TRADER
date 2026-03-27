"""
Geopolitical Trader — FastAPI backend
"""
import asyncio
import json
import logging
import os
import re
import smtplib
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import (
    NewsItemDB, PortfolioDB, SignalDB, SubscriberDB, UserDB,
    create_tables, get_db,
)
from auth import create_access_token, get_admin_user, get_current_user, hash_password, verify_password
from ml_engine import SignalEngine
from news_fetcher import fetch_all_feeds
from nlp_engine import GeopoliticalNLP
from price_fetcher import fetch_prices

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

    # Send email alerts for critical signals
    critical_unsent = db.query(SignalDB).filter(
        SignalDB.severity == "CRITICAL",
        SignalDB.emailed == False
    ).all()
    if critical_unsent:
        subscribers = db.query(SubscriberDB).filter_by(active=True).all()
        for sig in critical_unsent:
            send_email_alert(sig, subscribers)
            sig.emailed = True
        db.commit()

    return new_signals


def send_email_alert(signal: SignalDB, subscribers: list):
    smtp_host = os.environ.get("SMTP_HOST", "")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASS", "")
    smtp_from = os.environ.get("SMTP_FROM", smtp_user)

    if not smtp_host or not smtp_user or not smtp_pass:
        return

    subject = f"⚠️ CRITICAL ALERT: {signal.event_label} — {signal.news_title[:60]}"

    for sub in subscribers:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = smtp_from
            msg["To"] = sub.email

            body = f"""
GEOPOLITICAL TRADER — CRITICAL ALERT
=====================================
Event: {signal.event_label}
Severity: {signal.severity}
Source: {signal.source}

{signal.news_title}

{signal.news_summary or ""}

Market Signals:
"""
            for ms in (signal.market_signals or []):
                body += f"  {ms.get('signal')} {ms.get('asset_label')} — {ms.get('confidence')}% confidence\n"

            body += f"\nRead more: {signal.news_url or 'https://geotrader.io'}\n\n— GeoTrader Intelligence Platform"
            msg.attach(MIMEText(body, "plain"))

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
        except Exception as e:
            logger.warning("Failed to send email to %s: %s", sub.email, e)


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
    is_admin: bool = False


class PortfolioAddRequest(BaseModel):
    signal_id: str
    news_title: str
    asset: str
    asset_label: str
    category: str
    direction: str
    confidence: int
    entry_price: Optional[float] = None
    notes: Optional[str] = None


class PortfolioResponse(BaseModel):
    id: str
    signal_id: str
    news_title: str
    asset: str
    asset_label: str
    category: str
    direction: str
    confidence: int
    entry_price: Optional[float]
    notes: Optional[str]
    status: str
    created_at: datetime


class AdminUserResponse(BaseModel):
    id: str
    email: str
    name: str
    is_admin: bool
    is_active: bool
    created_at: datetime


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
    return UserResponse(id=user.id, email=user.email, name=user.name, is_admin=user.is_admin)


@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    user = db.query(UserDB).filter_by(email=email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "email": user.email, "name": user.name, "is_admin": user.is_admin}}


@app.get("/api/auth/me", response_model=UserResponse)
def me(current_user: UserDB = Depends(get_current_user)):
    return UserResponse(id=current_user.id, email=current_user.email, name=current_user.name, is_admin=current_user.is_admin)


@app.get("/api/admin/users", response_model=list[AdminUserResponse])
def admin_list_users(db: Session = Depends(get_db), admin: UserDB = Depends(get_admin_user)):
    users = db.query(UserDB).order_by(UserDB.created_at.desc()).all()
    return [AdminUserResponse(id=u.id, email=u.email, name=u.name, is_admin=u.is_admin, is_active=u.is_active, created_at=u.created_at) for u in users]


@app.patch("/api/admin/users/{user_id}/toggle")
def admin_toggle_user(user_id: str, db: Session = Depends(get_db), admin: UserDB = Depends(get_admin_user)):
    user = db.query(UserDB).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    user.is_active = not user.is_active
    db.commit()
    return {"id": user.id, "is_active": user.is_active}


@app.patch("/api/admin/users/{user_id}/make-admin")
def admin_make_admin(user_id: str, db: Session = Depends(get_db), admin: UserDB = Depends(get_admin_user)):
    user = db.query(UserDB).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = not user.is_admin
    db.commit()
    return {"id": user.id, "is_admin": user.is_admin}


@app.post("/api/portfolio", response_model=PortfolioResponse, status_code=201)
def add_to_portfolio(req: PortfolioAddRequest, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    existing = db.query(PortfolioDB).filter_by(user_id=current_user.id, signal_id=req.signal_id, asset=req.asset, status="OPEN").first()
    if existing:
        raise HTTPException(status_code=409, detail="Already tracking this trade")
    item = PortfolioDB(
        user_id=current_user.id,
        signal_id=req.signal_id,
        news_title=req.news_title,
        asset=req.asset,
        asset_label=req.asset_label,
        category=req.category or "",
        direction=req.direction,
        confidence=req.confidence,
        entry_price=req.entry_price,
        notes=req.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return PortfolioResponse(id=item.id, signal_id=item.signal_id, news_title=item.news_title, asset=item.asset, asset_label=item.asset_label, category=item.category, direction=item.direction, confidence=item.confidence, entry_price=item.entry_price, notes=item.notes, status=item.status, created_at=item.created_at)


@app.get("/api/portfolio", response_model=list[PortfolioResponse])
def get_portfolio(db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    items = db.query(PortfolioDB).filter_by(user_id=current_user.id).order_by(PortfolioDB.created_at.desc()).all()
    return [PortfolioResponse(id=i.id, signal_id=i.signal_id, news_title=i.news_title, asset=i.asset, asset_label=i.asset_label, category=i.category, direction=i.direction, confidence=i.confidence, entry_price=i.entry_price, notes=i.notes, status=i.status, created_at=i.created_at) for i in items]


@app.delete("/api/portfolio/{item_id}", status_code=204)
def remove_from_portfolio(item_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    item = db.query(PortfolioDB).filter_by(id=item_id, user_id=current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()


@app.patch("/api/portfolio/{item_id}/close", response_model=PortfolioResponse)
def close_trade(item_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    item = db.query(PortfolioDB).filter_by(id=item_id, user_id=current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    item.status = "CLOSED"
    db.commit()
    return PortfolioResponse(id=item.id, signal_id=item.signal_id, news_title=item.news_title, asset=item.asset, asset_label=item.asset_label, category=item.category, direction=item.direction, confidence=item.confidence, entry_price=item.entry_price, notes=item.notes, status=item.status, created_at=item.created_at)


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


@app.get("/api/prices")
def get_prices(current_user: UserDB = Depends(get_current_user)):
    try:
        prices = fetch_prices()
        return prices
    except Exception as e:
        logger.error("Price fetch error: %s", e)
        return {}


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