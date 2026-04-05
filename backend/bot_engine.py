"""
GeoTrader AI Bot Engine — Smart Aggressive Mode v2
- Market mismatch scoring: enter where market hasn't priced in geopolitical signals yet
- Pre-market analysis: 9 AM EST deep scan, stores top picks for the trading day
- Variable position sizing based on mismatch score
- 5-min cycles during market open window (9:30-10:30 AM EST)
- Lower entry threshold (65) for pre-market identified picks
- SHORT selling on strong bearish signals
- 2.5% stop-loss, 35% take-profit
"""
import logging
from datetime import datetime, timedelta, timezone

from database import (
    BotConfigDB, BotPositionDB, BotTradeDB, PreMarketPickDB, SignalDB, SessionLocal,
)
from price_fetcher import fetch_prices

logger = logging.getLogger(__name__)

SEVERITY_MULT = {"CRITICAL": 2.0, "HIGH": 1.5, "MEDIUM": 1.0, "LOW": 0.5}

# US market hours in UTC (EDT = UTC-4, April–October)
MARKET_OPEN_UTC  = 13   # 9:00 AM EDT
MARKET_CLOSE_UTC = 20   # 4:00 PM EDT
PREMARKET_UTC    = 13   # 9:00 AM EDT — pre-market scan trigger hour
AGGRESSIVE_START = 13   # 9:30 AM EDT (approx)
AGGRESSIVE_END   = 15   # 11:00 AM EDT — aggressive 5-min window


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def get_or_create_config(db) -> BotConfigDB:
    config = db.query(BotConfigDB).first()
    if not config:
        config = BotConfigDB(
            id=1,
            min_signal_score=80.0,
            stop_loss_pct=2.5,
            take_profit_pct=35.0,
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def is_market_hours() -> bool:
    """True if current UTC time is within US market hours (Mon–Fri)."""
    now = datetime.now(timezone.utc)
    if now.weekday() >= 5:  # Saturday=5, Sunday=6
        return False
    return MARKET_OPEN_UTC <= now.hour < MARKET_CLOSE_UTC


def is_aggressive_window() -> bool:
    """True during the first ~90 mins of market open — bot runs every 5 min."""
    now = datetime.now(timezone.utc)
    if now.weekday() >= 5:
        return False
    return AGGRESSIVE_START <= now.hour < AGGRESSIVE_END


def is_premarket_time() -> bool:
    """True at 9 AM EDT (13:00 UTC) on weekdays."""
    now = datetime.now(timezone.utc)
    if now.weekday() >= 5:
        return False
    return now.hour == PREMARKET_UTC


# ---------------------------------------------------------------------------
# Signal scoring — steeper recency decay + volume weighting
# ---------------------------------------------------------------------------

def compute_asset_score(asset: str, signals: list, now: datetime) -> tuple[float, str]:
    """
    Returns (score, top_reasoning).
    Positive = bullish, negative = bearish.
    """
    weighted_scores = []
    reasonings = []

    for sig in signals:
        for ms in (sig.market_signals or []):
            if ms.get("asset") != asset:
                continue

            confidence = float(ms.get("confidence", 0))
            direction  = 1.0 if ms.get("signal") == "BUY" else -1.0
            sev_mult   = SEVERITY_MULT.get(sig.severity, 1.0)

            age_hours = (now - sig.created_at).total_seconds() / 3600
            if age_hours < 1:
                recency = 1.0
            elif age_hours < 3:
                recency = 0.7
            elif age_hours < 6:
                recency = 0.4
            elif age_hours < 12:
                recency = 0.15
            else:
                recency = 0.05

            score = confidence * direction * sev_mult * recency
            weighted_scores.append(score)
            reasoning = ms.get("reasoning", "")[:100]
            reasonings.append(
                f"{ms.get('signal')} {confidence:.0f}% [{sig.severity}] {sig.news_title[:60]}: {reasoning}"
            )

    if not weighted_scores:
        return 0.0, ""

    volume_mult = min(1.0 + (len(weighted_scores) - 1) * 0.1, 1.5)
    raw = sum(weighted_scores) / len(weighted_scores)
    final = round(raw * volume_mult, 2)
    return final, reasonings[0] if reasonings else ""


# ---------------------------------------------------------------------------
# Mismatch scoring — the core of the new approach
# ---------------------------------------------------------------------------

def compute_mismatch_score(signal_score: float, direction: str, price_change_24h_pct: float) -> float:
    """
    Measures how much the market has NOT yet priced in the geopolitical signal.

    High mismatch (80+) = strong signal, price hasn't moved → big opportunity
    Low mismatch (<30)  = price already moved in signal direction → priced in, skip

    Score range: 0–150
    """
    abs_score = min(abs(signal_score), 100)

    # How aligned is the 24h price movement with the signal direction?
    alignment = price_change_24h_pct if direction == "BUY" else -price_change_24h_pct

    # 5% aligned move = fully priced in; opposite move = bonus opportunity
    price_factor = max(0.0, 1.0 - alignment / 5.0)
    price_factor = min(price_factor, 1.5)  # up to 50% bonus if price moved against signal

    return round(abs_score * price_factor, 1)


def mismatch_position_size(mismatch_score: float, config: BotConfigDB) -> float:
    """Scale position size to mismatch — bigger edge = bigger bet."""
    if mismatch_score >= 85:
        pct = 0.30   # 30% of capital — huge edge
    elif mismatch_score >= 70:
        pct = 0.25   # 25%
    elif mismatch_score >= 55:
        pct = 0.15   # 15%
    else:
        pct = config.max_position_pct / 100  # default

    max_usd = config.starting_capital * 0.30  # hard cap at 30%
    return min(config.starting_capital * pct, max_usd)


# ---------------------------------------------------------------------------
# Pre-market analysis — runs once at 9 AM EST
# ---------------------------------------------------------------------------

def run_premarket_analysis():
    """
    Deep scan run at 9 AM EST. Identifies top mismatch opportunities for the day.
    Stores top 7 picks in PreMarketPickDB for the bot to use with lower entry threshold.
    """
    db = SessionLocal()
    try:
        today = datetime.utcnow().strftime("%Y-%m-%d")

        # Already ran today?
        existing = db.query(PreMarketPickDB).filter_by(date=today).first()
        if existing:
            logger.info("PRE-MARKET | Analysis already done for %s", today)
            return

        logger.info("PRE-MARKET | ── Starting daily market scan ──")

        now = datetime.utcnow()
        cutoff = now - timedelta(hours=24)
        signals = db.query(SignalDB).filter(SignalDB.created_at >= cutoff).all()

        prices = fetch_prices()
        if not prices:
            logger.warning("PRE-MARKET | No prices available — skipping analysis")
            return

        # Collect all assets with signals
        asset_set: set[str] = set()
        for sig in signals:
            for ms in (sig.market_signals or []):
                if ms.get("asset"):
                    asset_set.add(ms["asset"])

        candidates = []
        for asset in asset_set:
            if asset not in prices:
                continue
            score, reasoning = compute_asset_score(asset, signals, now)
            if abs(score) < 30:  # ignore weak signals
                continue

            price_data = prices[asset]
            price_change = price_data.get("change_pct", 0)
            direction = "BUY" if score > 0 else "SELL"
            mismatch = compute_mismatch_score(score, direction, price_change)

            # Find asset label + category
            asset_label, category = asset, "Unknown"
            for sig in signals:
                for ms in (sig.market_signals or []):
                    if ms.get("asset") == asset:
                        asset_label = ms.get("asset_label", asset)
                        category = ms.get("category", "Unknown")
                        break

            candidates.append({
                "asset": asset,
                "asset_label": asset_label,
                "category": category,
                "direction": direction,
                "signal_score": round(score, 2),
                "mismatch_score": mismatch,
                "price": price_data["price"],
                "reasoning": reasoning,
            })

        # Sort by mismatch score — highest edge first
        candidates.sort(key=lambda x: x["mismatch_score"], reverse=True)
        top_picks = candidates[:7]

        for pick in top_picks:
            db.add(PreMarketPickDB(
                date=today,
                asset=pick["asset"],
                asset_label=pick["asset_label"],
                category=pick["category"],
                direction=pick["direction"],
                signal_score=pick["signal_score"],
                mismatch_score=pick["mismatch_score"],
                price_at_analysis=pick["price"],
                reasoning=pick["reasoning"],
            ))
            logger.info(
                "PRE-MARKET | PICK %-4s %-15s  mismatch=%.0f  score=%.1f",
                pick["direction"], pick["asset"], pick["mismatch_score"], pick["signal_score"],
            )

        db.commit()
        logger.info("PRE-MARKET | ── Scan complete. %d picks stored ──", len(top_picks))

    except Exception as e:
        logger.error("PRE-MARKET | Error: %s", e, exc_info=True)
        db.rollback()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _asset_meta(asset: str, signals: list) -> tuple[str, str]:
    for sig in signals:
        for ms in (sig.market_signals or []):
            if ms.get("asset") == asset:
                return ms.get("asset_label", asset), ms.get("category", "Unknown")
    return asset, "Unknown"


def _pnl_pct(pos: BotPositionDB, current_price: float) -> float:
    if pos.direction == "SELL":
        return (pos.entry_price - current_price) / pos.entry_price * 100
    return (current_price - pos.entry_price) / pos.entry_price * 100


# ---------------------------------------------------------------------------
# Main bot cycle
# ---------------------------------------------------------------------------

def run_bot_cycle():
    db = SessionLocal()
    try:
        config = get_or_create_config(db)
        if not config.enabled:
            return

        now = datetime.utcnow()
        logger.info("BOT | ── cycle start ──  cash=$%.2f", config.available_cash)

        prices = fetch_prices()
        if not prices:
            logger.warning("BOT | No prices available — skipping cycle")
            return

        cutoff  = now - timedelta(hours=12)
        signals = db.query(SignalDB).filter(SignalDB.created_at >= cutoff).all()

        # ── 1. Check exits on open positions ──────────────────────────────
        positions = db.query(BotPositionDB).all()
        for pos in positions:
            price_data = prices.get(pos.asset)
            if not price_data:
                continue

            current_price = price_data["price"]
            pnl_pct = _pnl_pct(pos, current_price)
            pnl_usd = round(pos.quantity_usd * pnl_pct / 100, 4)

            exit_action = None
            exit_reason = ""

            if pnl_pct <= -config.stop_loss_pct:
                exit_action = "STOP_LOSS"
                exit_reason = f"Stop-loss at {pnl_pct:.1f}% ({pos.direction} entry ${pos.entry_price:.4f} → ${current_price:.4f})"

            elif pnl_pct >= config.take_profit_pct:
                exit_action = "TAKE_PROFIT"
                exit_reason = f"Take-profit at +{pnl_pct:.1f}% ({pos.direction} entry ${pos.entry_price:.4f} → ${current_price:.4f})"

            else:
                score, _ = compute_asset_score(pos.asset, signals, now)
                if pos.direction == "BUY" and score < -config.min_signal_score * 0.5:
                    exit_action = "SIGNAL_EXIT"
                    exit_reason = f"Signal reversed bearish (score {score:.0f})"
                elif pos.direction == "SELL" and score > config.min_signal_score * 0.5:
                    exit_action = "SIGNAL_EXIT"
                    exit_reason = f"Signal reversed bullish (score {score:.0f})"

            if exit_action:
                config.available_cash = round(config.available_cash + pos.quantity_usd + pnl_usd, 4)
                db.add(BotTradeDB(
                    asset=pos.asset, asset_label=pos.asset_label, category=pos.category,
                    action=exit_action, price=current_price, quantity_usd=pos.quantity_usd,
                    signal_score=None, reasoning=exit_reason, pnl=pnl_usd,
                ))
                db.delete(pos)
                logger.info("BOT | EXIT %-12s %-12s  dir=%-4s  P&L=$%+.2f  %s",
                            exit_action, pos.asset, pos.direction, pnl_usd, exit_reason[:60])

        db.commit()

        # ── 2. Check entries — mismatch-driven ────────────────────────────
        open_assets    = {p.asset: p.direction for p in db.query(BotPositionDB).all()}
        position_count = len(open_assets)

        if position_count >= config.max_positions:
            logger.info("BOT | Max positions (%d) reached — no new entries", config.max_positions)
            logger.info("BOT | ── cycle end ──  cash=$%.2f  positions=%d", config.available_cash, position_count)
            return

        if config.available_cash < 5.0:
            logger.info("BOT | Insufficient cash ($%.2f) — skipping entries", config.available_cash)
            return

        # Load today's pre-market picks (get priority + lower threshold)
        today = now.strftime("%Y-%m-%d")
        premarket_assets = {
            p.asset: p for p in db.query(PreMarketPickDB).filter_by(date=today).all()
        }

        # Gather all asset candidates from recent signals
        asset_set: set[str] = set()
        for sig in signals:
            for ms in (sig.market_signals or []):
                if ms.get("asset"):
                    asset_set.add(ms["asset"])

        long_candidates  = []
        short_candidates = []

        for asset in asset_set:
            if asset in open_assets:
                continue
            if asset not in prices:
                continue

            score, reasoning = compute_asset_score(asset, signals, now)
            price_data = prices[asset]
            price_change = price_data.get("change_pct", 0)

            direction = "BUY" if score > 0 else "SELL"
            mismatch = compute_mismatch_score(score, direction, price_change)

            # Pre-market picks get a lower entry threshold (65 vs 80)
            is_premarket_pick = asset in premarket_assets
            threshold = config.min_signal_score * 0.80 if is_premarket_pick else config.min_signal_score

            abs_score = abs(score)
            if abs_score < threshold:
                continue
            if mismatch < 30:
                # Skip assets that are fully priced in (market already moved)
                logger.debug("BOT | SKIP %-12s  mismatch too low (%.0f) — already priced in", asset, mismatch)
                continue

            entry = (asset, abs_score, mismatch, reasoning, is_premarket_pick)
            if score > 0:
                long_candidates.append(entry)
            else:
                short_candidates.append(entry)

        # Sort by mismatch score — highest edge first
        long_candidates.sort(key=lambda x: x[2], reverse=True)
        short_candidates.sort(key=lambda x: x[2], reverse=True)

        # Interleave longs and shorts
        entries = []
        i, j = 0, 0
        while i < len(long_candidates) or j < len(short_candidates):
            if i < len(long_candidates):
                entries.append(("BUY",  *long_candidates[i]))
                i += 1
            if j < len(short_candidates):
                entries.append(("SELL", *short_candidates[j]))
                j += 1

        for direction, asset, score, mismatch, reasoning, is_premarket_pick in entries:
            if position_count >= config.max_positions:
                break
            if config.available_cash < 5.0:
                break

            price_data    = prices[asset]
            current_price = price_data["price"]
            if current_price <= 0:
                continue

            # Mismatch-scaled position size
            base_size = mismatch_position_size(mismatch, config)
            position_usd = min(
                round(base_size * (score / 100) * 0.5, 2),
                config.starting_capital * 0.30,
                config.available_cash,
            )
            position_usd = max(position_usd, 5.0)
            if position_usd > config.available_cash:
                continue

            asset_label, category = _asset_meta(asset, signals)

            if direction == "BUY":
                sl_price = round(current_price * (1 - config.stop_loss_pct / 100), 6)
                tp_price = round(current_price * (1 + config.take_profit_pct / 100), 6)
            else:
                sl_price = round(current_price * (1 + config.stop_loss_pct / 100), 6)
                tp_price = round(current_price * (1 - config.take_profit_pct / 100), 6)

            config.available_cash = round(config.available_cash - position_usd, 4)
            db.add(BotPositionDB(
                asset=asset, asset_label=asset_label, category=category,
                direction=direction, entry_price=current_price,
                quantity_usd=position_usd,
                entry_signal_score=score if direction == "BUY" else -score,
                entry_reasoning=f"[MISMATCH={mismatch:.0f}{'★PM' if is_premarket_pick else ''}] {reasoning}",
                stop_loss_price=sl_price, take_profit_price=tp_price,
            ))
            db.add(BotTradeDB(
                asset=asset, asset_label=asset_label, category=category,
                action=direction, price=current_price, quantity_usd=position_usd,
                signal_score=score if direction == "BUY" else -score,
                reasoning=f"[MISMATCH={mismatch:.0f}] {reasoning}",
                pnl=None,
            ))

            # Mark pre-market pick as acted on
            if is_premarket_pick and asset in premarket_assets:
                premarket_assets[asset].acted_on = True

            position_count += 1
            logger.info("BOT | %-4s %-12s $%.2f @ %.4f  score=%.0f  mismatch=%.0f%s",
                        direction, asset, position_usd, current_price, score, mismatch,
                        " ★PM" if is_premarket_pick else "")

        db.commit()

        positions_now  = db.query(BotPositionDB).all()
        position_value = sum(
            pos.quantity_usd * (1 + _pnl_pct(pos, prices[pos.asset]["price"]) / 100)
            for pos in positions_now
            if pos.asset in prices
        )
        total_value = round(config.available_cash + position_value, 2)
        logger.info("BOT | ── cycle end ──  cash=$%.2f  positions=%d  total=$%.2f",
                    config.available_cash, len(positions_now), total_value)

    except Exception as e:
        logger.error("BOT | Cycle error: %s", e, exc_info=True)
        db.rollback()
    finally:
        db.close()
