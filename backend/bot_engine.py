"""
GeoTrader AI Bot Engine
- Reads live geopolitical signals from the DB
- Scores each asset using confidence, severity, recency, and signal volume
- Opens/closes virtual positions based on configurable thresholds
- Runs every 15 minutes via the background task in main.py
"""
import logging
from datetime import datetime, timedelta

from database import (
    BotConfigDB, BotPositionDB, BotTradeDB, SignalDB, SessionLocal,
)
from price_fetcher import fetch_prices

logger = logging.getLogger(__name__)

SEVERITY_MULT = {"CRITICAL": 1.5, "HIGH": 1.2, "MEDIUM": 1.0, "LOW": 0.7}


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def get_or_create_config(db) -> BotConfigDB:
    config = db.query(BotConfigDB).first()
    if not config:
        config = BotConfigDB(id=1)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def compute_asset_score(asset: str, signals: list, now: datetime) -> tuple[float, str]:
    """
    Returns (score, top_reasoning).
    Positive score = bullish, negative = bearish.
    Scale: roughly -100 to +100.
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
            if age_hours < 2:
                recency = 1.0
            elif age_hours < 6:
                recency = 0.8
            elif age_hours < 12:
                recency = 0.6
            else:
                recency = 0.4

            score = confidence * direction * sev_mult * recency
            weighted_scores.append(score)

            reasoning = ms.get("reasoning", "")[:100]
            reasonings.append(
                f"{ms.get('signal')} {confidence:.0f}% [{sig.severity}] {sig.news_title[:60]}: {reasoning}"
            )

    if not weighted_scores:
        return 0.0, ""

    final = sum(weighted_scores) / len(weighted_scores)
    return round(final, 2), reasonings[0] if reasonings else ""


def _asset_meta(asset: str, signals: list) -> tuple[str, str]:
    """Return (asset_label, category) from the most recent signal mentioning this asset."""
    for sig in signals:
        for ms in (sig.market_signals or []):
            if ms.get("asset") == asset:
                return ms.get("asset_label", asset), ms.get("category", "Unknown")
    return asset, "Unknown"


# ---------------------------------------------------------------------------
# Main bot cycle
# ---------------------------------------------------------------------------

def run_bot_cycle():
    db = SessionLocal()
    try:
        config = get_or_create_config(db)
        if not config.enabled:
            return

        now    = datetime.utcnow()
        logger.info("BOT | ── cycle start ──  cash=$%.2f", config.available_cash)

        prices = fetch_prices()
        if not prices:
            logger.warning("BOT | No prices available — skipping cycle")
            return

        cutoff  = now - timedelta(hours=24)
        signals = db.query(SignalDB).filter(SignalDB.created_at >= cutoff).all()

        # ── 1. Check exits on open positions ──────────────────────────────
        positions = db.query(BotPositionDB).all()
        for pos in positions:
            price_data = prices.get(pos.asset)
            if not price_data:
                continue

            current_price = price_data["price"]
            pnl_pct = (current_price - pos.entry_price) / pos.entry_price * 100
            pnl_usd = round(pos.quantity_usd * pnl_pct / 100, 4)

            exit_action  = None
            exit_reason  = ""

            if pnl_pct <= -config.stop_loss_pct:
                exit_action = "STOP_LOSS"
                exit_reason = f"Stop-loss at {pnl_pct:.1f}% loss (entry ${pos.entry_price:.4f} → now ${current_price:.4f})"

            elif pnl_pct >= config.take_profit_pct:
                exit_action = "TAKE_PROFIT"
                exit_reason = f"Take-profit at +{pnl_pct:.1f}% gain (entry ${pos.entry_price:.4f} → now ${current_price:.4f})"

            else:
                score, _ = compute_asset_score(pos.asset, signals, now)
                if score < -50:
                    exit_action = "SIGNAL_EXIT"
                    exit_reason = f"Signal reversed strongly bearish (score {score:.0f})"

            if exit_action:
                config.available_cash = round(config.available_cash + pos.quantity_usd + pnl_usd, 4)
                db.add(BotTradeDB(
                    asset        = pos.asset,
                    asset_label  = pos.asset_label,
                    category     = pos.category,
                    action       = exit_action,
                    price        = current_price,
                    quantity_usd = pos.quantity_usd,
                    signal_score = None,
                    reasoning    = exit_reason,
                    pnl          = pnl_usd,
                ))
                db.delete(pos)
                logger.info("BOT | EXIT %-12s %-12s P&L=$%+.2f  %s", exit_action, pos.asset, pnl_usd, exit_reason[:60])

        db.commit()

        # ── 2. Check entries ───────────────────────────────────────────────
        open_assets     = {p.asset for p in db.query(BotPositionDB).all()}
        position_count  = len(open_assets)

        if position_count >= config.max_positions:
            logger.info("BOT | Max positions (%d) reached — no new entries", config.max_positions)
            return

        if config.available_cash < 5.0:
            logger.info("BOT | Insufficient cash ($%.2f) — skipping entries", config.available_cash)
            return

        # Gather all assets from recent signals
        asset_set: set[str] = set()
        for sig in signals:
            for ms in (sig.market_signals or []):
                asset_set.add(ms.get("asset"))

        # Score each candidate
        candidates = []
        for asset in asset_set:
            if asset in open_assets:
                continue
            if asset not in prices:
                continue
            score, reasoning = compute_asset_score(asset, signals, now)
            if score >= config.min_signal_score:
                candidates.append((asset, score, reasoning))

        candidates.sort(key=lambda x: x[1], reverse=True)

        for asset, score, reasoning in candidates:
            if position_count >= config.max_positions:
                break
            if config.available_cash < 5.0:
                break

            price_data    = prices[asset]
            current_price = price_data["price"]
            if current_price <= 0:
                continue

            # Size: proportional to score, capped at max_position_pct of total capital
            max_pos_usd  = (config.starting_capital * config.max_position_pct / 100)
            position_usd = min(
                round(config.available_cash * (score / 100) * 0.4, 2),
                max_pos_usd,
                config.available_cash,
            )
            position_usd = max(position_usd, 5.0)
            if position_usd > config.available_cash:
                continue

            asset_label, category = _asset_meta(asset, signals)

            config.available_cash = round(config.available_cash - position_usd, 4)
            db.add(BotPositionDB(
                asset               = asset,
                asset_label         = asset_label,
                category            = category,
                direction           = "BUY",
                entry_price         = current_price,
                quantity_usd        = position_usd,
                entry_signal_score  = score,
                entry_reasoning     = reasoning,
                stop_loss_price     = round(current_price * (1 - config.stop_loss_pct / 100), 6),
                take_profit_price   = round(current_price * (1 + config.take_profit_pct / 100), 6),
            ))
            db.add(BotTradeDB(
                asset        = asset,
                asset_label  = asset_label,
                category     = category,
                action       = "BUY",
                price        = current_price,
                quantity_usd = position_usd,
                signal_score = score,
                reasoning    = reasoning,
                pnl          = None,
            ))
            position_count += 1
            logger.info("BOT | BUY  %-12s $%.2f @ %.4f  score=%.0f", asset, position_usd, current_price, score)

        db.commit()

        positions_now = db.query(BotPositionDB).all()
        position_value = sum(
            pos.quantity_usd * (prices[pos.asset]["price"] / pos.entry_price)
            for pos in positions_now
            if pos.asset in prices
        )
        total_value = round(config.available_cash + position_value, 2)
        logger.info(
            "BOT | ── cycle end ──  cash=$%.2f  positions=%d  total=$%.2f",
            config.available_cash, len(positions_now), total_value,
        )

    except Exception as e:
        logger.error("BOT | Cycle error: %s", e, exc_info=True)
        db.rollback()
    finally:
        db.close()
