"""
GeoTrader AI Bot Engine — Aggressive Mode
- Higher min signal score (80+)
- Tighter stop-loss (2.5%)
- Higher take-profit (25%)
- SHORT selling on strong bearish signals
- Steeper recency decay + signal volume weighting
"""
import logging
from datetime import datetime, timedelta

from database import (
    BotConfigDB, BotPositionDB, BotTradeDB, SignalDB, SessionLocal,
)
from price_fetcher import fetch_prices

logger = logging.getLogger(__name__)

SEVERITY_MULT = {"CRITICAL": 2.0, "HIGH": 1.5, "MEDIUM": 1.0, "LOW": 0.5}


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
            take_profit_pct=25.0,
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


# ---------------------------------------------------------------------------
# Scoring — steeper recency decay + volume weighting
# ---------------------------------------------------------------------------

def compute_asset_score(asset: str, signals: list, now: datetime) -> tuple[float, str]:
    """
    Returns (score, top_reasoning).
    Positive = bullish, negative = bearish.
    Steeper recency decay: signals older than 6h carry little weight.
    Volume bonus: more corroborating signals amplify the score.
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

            # Steeper recency decay — stale signals barely count
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

    # Volume multiplier: more signals = higher conviction (up to 1.5x)
    volume_mult = min(1.0 + (len(weighted_scores) - 1) * 0.1, 1.5)
    raw = sum(weighted_scores) / len(weighted_scores)
    final = round(raw * volume_mult, 2)

    # Sort reasonings by absolute score contribution
    best_reasoning = reasonings[0] if reasonings else ""
    return final, best_reasoning


def _asset_meta(asset: str, signals: list) -> tuple[str, str]:
    for sig in signals:
        for ms in (sig.market_signals or []):
            if ms.get("asset") == asset:
                return ms.get("asset_label", asset), ms.get("category", "Unknown")
    return asset, "Unknown"


def _pnl_pct(pos: BotPositionDB, current_price: float) -> float:
    """P&L % accounting for direction (BUY profits on up, SELL profits on down)."""
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

        # Use 12h window — with steeper decay, older signals barely affect score
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

            # Tighter stop-loss — cut losers fast
            if pnl_pct <= -config.stop_loss_pct:
                exit_action = "STOP_LOSS"
                exit_reason = f"Stop-loss at {pnl_pct:.1f}% ({pos.direction} entry ${pos.entry_price:.4f} → ${current_price:.4f})"

            elif pnl_pct >= config.take_profit_pct:
                exit_action = "TAKE_PROFIT"
                exit_reason = f"Take-profit at +{pnl_pct:.1f}% ({pos.direction} entry ${pos.entry_price:.4f} → ${current_price:.4f})"

            else:
                score, _ = compute_asset_score(pos.asset, signals, now)
                # Exit BUY if signal flips strongly bearish
                if pos.direction == "BUY" and score < -config.min_signal_score * 0.5:
                    exit_action = "SIGNAL_EXIT"
                    exit_reason = f"Signal reversed bearish (score {score:.0f})"
                # Exit SELL if signal flips strongly bullish
                elif pos.direction == "SELL" and score > config.min_signal_score * 0.5:
                    exit_action = "SIGNAL_EXIT"
                    exit_reason = f"Signal reversed bullish (score {score:.0f})"

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
                logger.info("BOT | EXIT %-12s %-12s  dir=%-4s  P&L=$%+.2f  %s",
                            exit_action, pos.asset, pos.direction, pnl_usd, exit_reason[:60])

        db.commit()

        # ── 2. Check entries — BUY and SHORT ──────────────────────────────
        open_assets    = {p.asset: p.direction for p in db.query(BotPositionDB).all()}
        position_count = len(open_assets)

        if position_count >= config.max_positions:
            logger.info("BOT | Max positions (%d) reached — no new entries", config.max_positions)
            logger.info("BOT | ── cycle end ──  cash=$%.2f  positions=%d", config.available_cash, position_count)
            return

        if config.available_cash < 5.0:
            logger.info("BOT | Insufficient cash ($%.2f) — skipping entries", config.available_cash)
            return

        # Gather all assets from recent signals
        asset_set: set[str] = set()
        for sig in signals:
            for ms in (sig.market_signals or []):
                if ms.get("asset"):
                    asset_set.add(ms["asset"])

        # Score each candidate
        long_candidates  = []   # strong bullish
        short_candidates = []   # strong bearish

        for asset in asset_set:
            if asset in open_assets:
                continue
            if asset not in prices:
                continue
            score, reasoning = compute_asset_score(asset, signals, now)

            if score >= config.min_signal_score:
                long_candidates.append((asset, score, reasoning))
            elif score <= -config.min_signal_score:
                short_candidates.append((asset, abs(score), reasoning))

        long_candidates.sort(key=lambda x: x[1], reverse=True)
        short_candidates.sort(key=lambda x: x[1], reverse=True)

        # Interleave longs and shorts — take best from each alternately
        entries = []
        i, j = 0, 0
        while i < len(long_candidates) or j < len(short_candidates):
            if i < len(long_candidates):
                entries.append(("BUY",  *long_candidates[i]))
                i += 1
            if j < len(short_candidates):
                entries.append(("SELL", *short_candidates[j]))
                j += 1

        for direction, asset, score, reasoning in entries:
            if position_count >= config.max_positions:
                break
            if config.available_cash < 5.0:
                break

            price_data    = prices[asset]
            current_price = price_data["price"]
            if current_price <= 0:
                continue

            max_pos_usd  = config.starting_capital * config.max_position_pct / 100
            position_usd = min(
                round(config.available_cash * (score / 100) * 0.5, 2),
                max_pos_usd,
                config.available_cash,
            )
            position_usd = max(position_usd, 5.0)
            if position_usd > config.available_cash:
                continue

            asset_label, category = _asset_meta(asset, signals)

            # Stop/take prices depend on direction
            if direction == "BUY":
                sl_price = round(current_price * (1 - config.stop_loss_pct / 100), 6)
                tp_price = round(current_price * (1 + config.take_profit_pct / 100), 6)
            else:
                sl_price = round(current_price * (1 + config.stop_loss_pct / 100), 6)
                tp_price = round(current_price * (1 - config.take_profit_pct / 100), 6)

            config.available_cash = round(config.available_cash - position_usd, 4)
            db.add(BotPositionDB(
                asset               = asset,
                asset_label         = asset_label,
                category            = category,
                direction           = direction,
                entry_price         = current_price,
                quantity_usd        = position_usd,
                entry_signal_score  = score if direction == "BUY" else -score,
                entry_reasoning     = reasoning,
                stop_loss_price     = sl_price,
                take_profit_price   = tp_price,
            ))
            db.add(BotTradeDB(
                asset        = asset,
                asset_label  = asset_label,
                category     = category,
                action       = direction,
                price        = current_price,
                quantity_usd = position_usd,
                signal_score = score if direction == "BUY" else -score,
                reasoning    = reasoning,
                pnl          = None,
            ))
            position_count += 1
            logger.info("BOT | %-4s %-12s $%.2f @ %.4f  score=%.0f",
                        direction, asset, position_usd, current_price, score)

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
