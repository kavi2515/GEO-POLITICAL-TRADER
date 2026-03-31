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

from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import (
    BotConfigDB, BotPositionDB, BotTradeDB,
    NewsItemDB, PasswordResetTokenDB, PortfolioDB, SignalDB, SubscriberDB, UserDB,
    WatchlistDB, create_tables, get_db,
)
from bot_engine import run_bot_cycle, get_or_create_config
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
    bot_tick = 0
    while True:
        db = SessionLocal()
        try:
            await process_news(db)
        except Exception as exc:
            logger.error("Background loop error: %s", exc)
        finally:
            db.close()

        # Run bot every 3 cycles (~15 min)
        bot_tick += 1
        if bot_tick >= 3:
            bot_tick = 0
            try:
                run_bot_cycle()
            except Exception as exc:
                logger.error("Bot cycle error: %s", exc)

        await asyncio.sleep(300)  # 5 minutes per cycle


# ---------------------------------------------------------------------------
# App lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    task = asyncio.create_task(background_loop())
    yield
    task.cancel()


limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Geopolitical Trader API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://geotrader.io", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
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
@limiter.limit("5/minute")
def register(request: Request, req: RegisterRequest, db: Session = Depends(get_db)):
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
@limiter.limit("10/minute")
def login(request: Request, req: LoginRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    user = db.query(UserDB).filter_by(email=email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "email": user.email, "name": user.name, "is_admin": user.is_admin}}


@app.get("/api/auth/me", response_model=UserResponse)
def me(current_user: UserDB = Depends(get_current_user)):
    return UserResponse(id=current_user.id, email=current_user.email, name=current_user.name, is_admin=current_user.is_admin)


class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@app.post("/api/auth/forgot-password", status_code=200)
@limiter.limit("3/minute")
def forgot_password(request: Request, req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    import secrets as _secrets
    email = req.email.strip().lower()
    user = db.query(UserDB).filter_by(email=email).first()
    # Always return success to avoid email enumeration
    if user:
        token = _secrets.token_urlsafe(32)
        expires = datetime.utcnow() + timedelta(hours=1)
        db.add(PasswordResetTokenDB(user_id=user.id, token=token, expires_at=expires))
        db.commit()

        reset_link = f"https://geotrader.io/reset-password?token={token}"
        smtp_host = os.environ.get("SMTP_HOST", "")
        smtp_user = os.environ.get("SMTP_USER", "")
        smtp_pass = os.environ.get("SMTP_PASS", "")
        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        if smtp_host and smtp_user and smtp_pass:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = "GeoTrader — Reset Your Password"
                msg["From"] = smtp_user
                msg["To"] = email
                body = f"""Hi {user.name},\n\nClick the link below to reset your GeoTrader password. This link expires in 1 hour.\n\n{reset_link}\n\nIf you did not request a password reset, ignore this email.\n\n— GeoTrader"""
                msg.attach(MIMEText(body, "plain"))
                with smtplib.SMTP(smtp_host, smtp_port) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_pass)
                    server.sendmail(smtp_user, email, msg.as_string())
            except Exception as e:
                logger.warning("Failed to send password reset email: %s", e)
    return {"message": "If that email is registered, a reset link has been sent."}


@app.post("/api/auth/reset-password", status_code=200)
@limiter.limit("5/minute")
def reset_password(request: Request, req: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(req.new_password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters")
    record = db.query(PasswordResetTokenDB).filter_by(token=req.token, used=False).first()
    if not record or record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user = db.query(UserDB).filter_by(id=record.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    user.hashed_password = hash_password(req.new_password)
    record.used = True
    db.commit()
    return {"message": "Password updated successfully"}


@app.delete("/api/auth/account", status_code=204)
def delete_account(current_user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(PortfolioDB).filter_by(user_id=current_user.id).delete()
    db.query(SubscriberDB).filter_by(email=current_user.email).delete()
    db.query(PasswordResetTokenDB).filter_by(user_id=current_user.id).delete()
    db.delete(current_user)
    db.commit()


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
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own admin status")
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
async def websocket_endpoint(websocket: WebSocket, token: str = ""):
    from auth import get_current_user as _get_user
    from database import SessionLocal as _SL
    db = _SL()
    try:
        _get_user(token=token, db=db)
    except Exception:
        await websocket.close(code=1008)
        db.close()
        return
    db.close()
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/api/chart/{asset_key:path}")
def get_chart(asset_key: str, timeframe: str = "30d", current_user: UserDB = Depends(get_current_user)):
    from price_fetcher import fetch_history, fetch_intraday
    intraday_map = {"1m": 1, "5m": 5, "1h": 60, "24h": 60}
    if timeframe in intraday_map:
        return fetch_intraday(asset_key, intraday_map[timeframe])
    day_map = {"7d": 7, "30d": 30, "90d": 90}
    return fetch_history(asset_key, day_map.get(timeframe, 30))


# ---------------------------------------------------------------------------
# Bot API — admin only
# ---------------------------------------------------------------------------

class BotConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    starting_capital: Optional[float] = None
    min_signal_score: Optional[float] = None
    max_position_pct: Optional[float] = None
    stop_loss_pct: Optional[float] = None
    take_profit_pct: Optional[float] = None
    max_positions: Optional[int] = None


@app.get("/api/bot/status")
def bot_status(db: Session = Depends(get_db), current_user: UserDB = Depends(get_admin_user)):
    from price_fetcher import fetch_prices as _fp
    config    = get_or_create_config(db)
    positions = db.query(BotPositionDB).order_by(BotPositionDB.created_at.desc()).all()
    prices    = _fp()

    position_data = []
    position_value = 0.0
    for pos in positions:
        p = prices.get(pos.asset, {})
        current_price = p.get("price", pos.entry_price)
        if pos.direction == "SELL":
            pnl_pct = (pos.entry_price - current_price) / pos.entry_price * 100 if pos.entry_price else 0
        else:
            pnl_pct = (current_price - pos.entry_price) / pos.entry_price * 100 if pos.entry_price else 0
        pnl_usd = round(pos.quantity_usd * pnl_pct / 100, 4)
        current_value = round(pos.quantity_usd + pnl_usd, 4)
        position_value += current_value
        position_data.append({
            "id":                 pos.id,
            "asset":              pos.asset,
            "asset_label":        pos.asset_label,
            "category":           pos.category,
            "direction":          pos.direction,
            "entry_price":        pos.entry_price,
            "current_price":      round(current_price, 6),
            "quantity_usd":       pos.quantity_usd,
            "current_value":      current_value,
            "pnl_pct":            round(pnl_pct, 2),
            "pnl_usd":            pnl_usd,
            "stop_loss_price":    pos.stop_loss_price,
            "take_profit_price":  pos.take_profit_price,
            "entry_signal_score": pos.entry_signal_score,
            "entry_reasoning":    pos.entry_reasoning,
            "opened_at":          pos.created_at.isoformat(),
        })

    total_value  = round(config.available_cash + position_value, 2)
    total_pnl    = round(total_value - config.starting_capital, 2)
    total_pnl_pct = round(total_pnl / config.starting_capital * 100, 2) if config.starting_capital else 0

    return {
        "enabled":          config.enabled,
        "starting_capital": config.starting_capital,
        "available_cash":   round(config.available_cash, 2),
        "position_value":   round(position_value, 2),
        "total_value":      total_value,
        "total_pnl":        total_pnl,
        "total_pnl_pct":    total_pnl_pct,
        "positions":        position_data,
        "config": {
            "min_signal_score": config.min_signal_score,
            "max_position_pct": config.max_position_pct,
            "stop_loss_pct":    config.stop_loss_pct,
            "take_profit_pct":  config.take_profit_pct,
            "max_positions":    config.max_positions,
        },
    }


@app.get("/api/bot/trades")
def bot_trades(limit: int = 100, db: Session = Depends(get_db), current_user: UserDB = Depends(get_admin_user)):
    trades = db.query(BotTradeDB).order_by(BotTradeDB.created_at.desc()).limit(limit).all()
    return [
        {
            "id":           t.id,
            "asset":        t.asset,
            "asset_label":  t.asset_label,
            "category":     t.category,
            "action":       t.action,
            "price":        t.price,
            "quantity_usd": t.quantity_usd,
            "signal_score": t.signal_score,
            "reasoning":    t.reasoning,
            "pnl":          t.pnl,
            "created_at":   t.created_at.isoformat(),
        }
        for t in trades
    ]


@app.patch("/api/bot/config")
def update_bot_config(req: BotConfigUpdate, db: Session = Depends(get_db), current_user: UserDB = Depends(get_admin_user)):
    if req.starting_capital is not None and req.starting_capital < 1:
        raise HTTPException(status_code=422, detail="Starting capital must be at least $1")
    if req.min_signal_score is not None and not (0 <= req.min_signal_score <= 200):
        raise HTTPException(status_code=422, detail="Min signal score must be 0–200")
    if req.max_position_pct is not None and not (1 <= req.max_position_pct <= 100):
        raise HTTPException(status_code=422, detail="Max position size must be 1–100%")
    if req.stop_loss_pct is not None and not (0.1 <= req.stop_loss_pct <= 50):
        raise HTTPException(status_code=422, detail="Stop loss must be 0.1–50%")
    if req.take_profit_pct is not None and not (0.1 <= req.take_profit_pct <= 500):
        raise HTTPException(status_code=422, detail="Take profit must be 0.1–500%")
    if req.max_positions is not None and not (1 <= req.max_positions <= 20):
        raise HTTPException(status_code=422, detail="Max positions must be 1–20")

    config = get_or_create_config(db)

    # If re-initialising capital, reset available cash too
    if req.starting_capital is not None and req.starting_capital != config.starting_capital:
        config.starting_capital = req.starting_capital
        config.available_cash   = req.starting_capital
        db.query(BotPositionDB).delete()

    if req.enabled is not None:             config.enabled          = req.enabled
    if req.min_signal_score is not None:    config.min_signal_score = req.min_signal_score
    if req.max_position_pct is not None:    config.max_position_pct = req.max_position_pct
    if req.stop_loss_pct is not None:       config.stop_loss_pct    = req.stop_loss_pct
    if req.take_profit_pct is not None:     config.take_profit_pct  = req.take_profit_pct
    if req.max_positions is not None:       config.max_positions    = req.max_positions

    config.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Bot config updated"}


@app.post("/api/bot/run")
def bot_run_now(db: Session = Depends(get_db), current_user: UserDB = Depends(get_admin_user)):
    """Manually trigger one bot cycle."""
    try:
        run_bot_cycle()
        return {"message": "Bot cycle completed"}
    except Exception as e:
        logger.error("Bot run error: %s", e)
        raise HTTPException(status_code=500, detail="Bot cycle failed")


# ---------------------------------------------------------------------------
# Watchlist API
# ---------------------------------------------------------------------------

class WatchlistAddRequest(BaseModel):
    asset: str
    asset_label: str
    category: Optional[str] = ""


@app.get("/api/watchlist")
def get_watchlist(db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    items = db.query(WatchlistDB).filter_by(user_id=current_user.id).order_by(WatchlistDB.created_at.asc()).all()
    return [{"id": i.id, "asset": i.asset, "asset_label": i.asset_label, "category": i.category, "created_at": i.created_at.isoformat()} for i in items]


@app.post("/api/watchlist", status_code=201)
def add_to_watchlist(req: WatchlistAddRequest, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    existing = db.query(WatchlistDB).filter_by(user_id=current_user.id, asset=req.asset).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already in watchlist")
    item = WatchlistDB(user_id=current_user.id, asset=req.asset, asset_label=req.asset_label, category=req.category or "")
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "asset": item.asset, "asset_label": item.asset_label, "category": item.category, "created_at": item.created_at.isoformat()}


@app.delete("/api/watchlist/{asset:path}", status_code=204)
def remove_from_watchlist(asset: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    item = db.query(WatchlistDB).filter_by(user_id=current_user.id, asset=asset).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()


@app.get("/api/watchlist/signals")
def get_watchlist_signals(db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    """Return recent signals for assets in the user's watchlist."""
    items = db.query(WatchlistDB).filter_by(user_id=current_user.id).all()
    watched_assets = {i.asset for i in items}
    if not watched_assets:
        return []

    cutoff = datetime.utcnow() - timedelta(hours=48)
    signals = db.query(SignalDB).filter(SignalDB.created_at >= cutoff).order_by(SignalDB.published_at.desc()).limit(200).all()

    results = []
    for s in signals:
        ms = [m for m in (s.market_signals or []) if m.get("asset") in watched_assets]
        if not ms:
            continue
        results.append({
            "id": s.id,
            "news_title": s.news_title,
            "news_url": s.news_url,
            "source": s.source,
            "published_at": s.published_at.isoformat(),
            "severity": s.severity,
            "event_label": s.event_label,
            "market_signals": ms,
        })
        if len(results) >= 50:
            break
    return results


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