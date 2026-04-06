"""
GeoTrader AI Bot Engine — v3
Three bot types (all admin-only):
  1. Standard Bot  — mismatch-driven entries, variable position sizing
  2. Sniper Bot    — fires only on extreme mismatch + signal score
  3. Grid Bot      — places orders at price intervals, profits from volatility
Per-asset config overrides global settings for any bot.
"""
import logging
from datetime import datetime, timedelta, timezone

from database import (
    AssetBotConfigDB, BotConfigDB, BotPositionDB, BotTradeDB,
    GridBotDB, GridOrderDB, PreMarketPickDB, SignalDB, SessionLocal,
    SniperConfigDB,
)
from price_fetcher import fetch_prices

logger = logging.getLogger(__name__)

SEVERITY_MULT = {"CRITICAL": 2.0, "HIGH": 1.5, "MEDIUM": 1.0, "LOW": 0.5}
SNIPER_TAG    = "[SNIPER]"

# US market hours UTC (EDT = UTC-4, April–October)
MARKET_OPEN_UTC  = 13
MARKET_CLOSE_UTC = 20
PREMARKET_UTC    = 13
AGGRESSIVE_START = 13
AGGRESSIVE_END   = 15


# ---------------------------------------------------------------------------
# Market-time helpers
# ---------------------------------------------------------------------------

def is_market_hours() -> bool:
    now = datetime.now(timezone.utc)
    return now.weekday() < 5 and MARKET_OPEN_UTC <= now.hour < MARKET_CLOSE_UTC


def is_aggressive_window() -> bool:
    now = datetime.now(timezone.utc)
    return now.weekday() < 5 and AGGRESSIVE_START <= now.hour < AGGRESSIVE_END


def is_premarket_time() -> bool:
    now = datetime.now(timezone.utc)
    return now.weekday() < 5 and now.hour == PREMARKET_UTC


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def get_or_create_config(db) -> BotConfigDB:
    cfg = db.query(BotConfigDB).first()
    if not cfg:
        cfg = BotConfigDB(id=1, min_signal_score=80.0, stop_loss_pct=2.5, take_profit_pct=35.0)
        db.add(cfg); db.commit(); db.refresh(cfg)
    return cfg


def get_or_create_sniper_config(db) -> SniperConfigDB:
    cfg = db.query(SniperConfigDB).first()
    if not cfg:
        cfg = SniperConfigDB(id=1)
        db.add(cfg); db.commit(); db.refresh(cfg)
    return cfg


def get_asset_config(asset: str, db) -> AssetBotConfigDB | None:
    return db.query(AssetBotConfigDB).filter_by(asset=asset).first()


def _resolve(override, default):
    """Return override if set, else default."""
    return override if override is not None else default


# ---------------------------------------------------------------------------
# Signal scoring
# ---------------------------------------------------------------------------

def compute_asset_score(asset: str, signals: list, now: datetime) -> tuple[float, str]:
    weighted, reasonings = [], []
    for sig in signals:
        for ms in (sig.market_signals or []):
            if ms.get("asset") != asset:
                continue
            confidence = float(ms.get("confidence", 0))
            direction  = 1.0 if ms.get("signal") == "BUY" else -1.0
            sev_mult   = SEVERITY_MULT.get(sig.severity, 1.0)
            age_hours  = (now - sig.created_at).total_seconds() / 3600
            recency    = (1.0 if age_hours < 1 else 0.7 if age_hours < 3
                          else 0.4 if age_hours < 6 else 0.15 if age_hours < 12 else 0.05)
            weighted.append(confidence * direction * sev_mult * recency)
            reasonings.append(
                f"{ms.get('signal')} {confidence:.0f}% [{sig.severity}] "
                f"{sig.news_title[:60]}: {ms.get('reasoning','')[:100]}"
            )
    if not weighted:
        return 0.0, ""
    vol_mult = min(1.0 + (len(weighted) - 1) * 0.1, 1.5)
    return round(sum(weighted) / len(weighted) * vol_mult, 2), reasonings[0]


# ---------------------------------------------------------------------------
# Mismatch scoring
# ---------------------------------------------------------------------------

def compute_mismatch_score(signal_score: float, direction: str, price_change_24h_pct: float) -> float:
    abs_score  = min(abs(signal_score), 100)
    alignment  = price_change_24h_pct if direction == "BUY" else -price_change_24h_pct
    price_factor = min(max(0.0, 1.0 - alignment / 5.0), 1.5)
    return round(abs_score * price_factor, 1)


def mismatch_position_size(mismatch: float, config: BotConfigDB) -> float:
    pct = 0.30 if mismatch >= 85 else 0.25 if mismatch >= 70 else 0.15 if mismatch >= 55 else config.max_position_pct / 100
    return min(config.starting_capital * pct, config.starting_capital * 0.30)


# ---------------------------------------------------------------------------
# Shared helpers
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


def _check_exits(positions, prices, signals, config, now, db):
    """Shared exit logic for all bots. Mutates db."""
    for pos in positions:
        pd = prices.get(pos.asset)
        if not pd:
            continue
        current_price = pd["price"]
        pnl_pct = _pnl_pct(pos, current_price)
        pnl_usd = round(pos.quantity_usd * pnl_pct / 100, 4)

        acfg = get_asset_config(pos.asset, db)
        sl_pct = _resolve(acfg.stop_loss_pct if acfg else None, config.stop_loss_pct)
        tp_pct = _resolve(acfg.take_profit_pct if acfg else None, config.take_profit_pct)

        exit_action, exit_reason = None, ""

        if pnl_pct <= -sl_pct:
            exit_action = "STOP_LOSS"
            exit_reason = f"Stop-loss at {pnl_pct:.1f}% ({pos.direction} ${pos.entry_price:.4f}→${current_price:.4f})"
        elif pnl_pct >= tp_pct:
            exit_action = "TAKE_PROFIT"
            exit_reason = f"Take-profit at +{pnl_pct:.1f}% ({pos.direction} ${pos.entry_price:.4f}→${current_price:.4f})"
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
            logger.info("BOT | EXIT %-12s %-12s  P&L=$%+.2f  %s",
                        exit_action, pos.asset, pnl_usd, exit_reason[:60])


# ---------------------------------------------------------------------------
# Pre-market analysis
# ---------------------------------------------------------------------------

def run_premarket_analysis():
    db = SessionLocal()
    try:
        today = datetime.utcnow().strftime("%Y-%m-%d")
        if db.query(PreMarketPickDB).filter_by(date=today).first():
            logger.info("PRE-MARKET | Already done for %s", today)
            return

        logger.info("PRE-MARKET | ── Starting daily market scan ──")
        now    = datetime.utcnow()
        prices = fetch_prices()
        if not prices:
            return

        signals = db.query(SignalDB).filter(SignalDB.created_at >= now - timedelta(hours=24)).all()
        asset_set = {ms["asset"] for sig in signals for ms in (sig.market_signals or []) if ms.get("asset")}

        candidates = []
        for asset in asset_set:
            if asset not in prices:
                continue
            score, reasoning = compute_asset_score(asset, signals, now)
            if abs(score) < 30:
                continue
            direction = "BUY" if score > 0 else "SELL"
            mismatch  = compute_mismatch_score(score, direction, prices[asset].get("change_pct", 0))
            lbl, cat  = asset, "Unknown"
            for sig in signals:
                for ms in (sig.market_signals or []):
                    if ms.get("asset") == asset:
                        lbl, cat = ms.get("asset_label", asset), ms.get("category", "Unknown")
                        break
            candidates.append((asset, lbl, cat, direction, score, mismatch, prices[asset]["price"], reasoning))

        candidates.sort(key=lambda x: x[5], reverse=True)
        for asset, lbl, cat, direction, score, mismatch, price, reasoning in candidates[:7]:
            db.add(PreMarketPickDB(
                date=today, asset=asset, asset_label=lbl, category=cat,
                direction=direction, signal_score=round(score, 2),
                mismatch_score=mismatch, price_at_analysis=price, reasoning=reasoning,
            ))
            logger.info("PRE-MARKET | PICK %-4s %-15s  mismatch=%.0f", direction, asset, mismatch)
        db.commit()
        logger.info("PRE-MARKET | ── Scan complete ──")
    except Exception as e:
        logger.error("PRE-MARKET | %s", e, exc_info=True)
        db.rollback()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 1. Standard bot cycle
# ---------------------------------------------------------------------------

def run_bot_cycle():
    db = SessionLocal()
    try:
        config = get_or_create_config(db)
        if not config.enabled:
            return

        now    = datetime.utcnow()
        prices = fetch_prices()
        if not prices:
            return

        logger.info("BOT | ── cycle start ──  cash=$%.2f", config.available_cash)

        signals  = db.query(SignalDB).filter(SignalDB.created_at >= now - timedelta(hours=12)).all()
        positions = db.query(BotPositionDB).all()

        # Exit check
        _check_exits(positions, prices, signals, config, now, db)
        db.commit()

        # Entry check
        open_assets    = {p.asset for p in db.query(BotPositionDB).all()}
        position_count = len(open_assets)

        if position_count >= config.max_positions or config.available_cash < 5.0:
            logger.info("BOT | Max positions or low cash — skipping entries")
            logger.info("BOT | ── cycle end ──  cash=$%.2f  positions=%d", config.available_cash, position_count)
            return

        today = now.strftime("%Y-%m-%d")
        premarket_assets = {p.asset: p for p in db.query(PreMarketPickDB).filter_by(date=today).all()}

        asset_set = {ms["asset"] for sig in signals for ms in (sig.market_signals or []) if ms.get("asset")}

        long_cands, short_cands = [], []
        for asset in asset_set:
            if asset in open_assets or asset not in prices:
                continue
            acfg = get_asset_config(asset, db)
            if acfg and (not acfg.enabled or acfg.sniper_only):
                continue

            score, reasoning = compute_asset_score(asset, signals, now)
            direction  = "BUY" if score > 0 else "SELL"
            mismatch   = compute_mismatch_score(score, direction, prices[asset].get("change_pct", 0))

            is_pm    = asset in premarket_assets
            base_min = _resolve(acfg.min_signal_score if acfg else None, config.min_signal_score)
            threshold = base_min * 0.80 if is_pm else base_min

            if abs(score) < threshold or mismatch < 30:
                continue

            entry = (asset, abs(score), mismatch, reasoning, is_pm)
            if score > 0:
                long_cands.append(entry)
            else:
                short_cands.append(entry)

        long_cands.sort(key=lambda x: x[2], reverse=True)
        short_cands.sort(key=lambda x: x[2], reverse=True)

        entries, i, j = [], 0, 0
        while i < len(long_cands) or j < len(short_cands):
            if i < len(long_cands):  entries.append(("BUY",  *long_cands[i]));  i += 1
            if j < len(short_cands): entries.append(("SELL", *short_cands[j])); j += 1

        for direction, asset, score, mismatch, reasoning, is_pm in entries:
            if position_count >= config.max_positions or config.available_cash < 5.0:
                break
            acfg          = get_asset_config(asset, db)
            cp            = prices[asset]["price"]
            if cp <= 0: continue

            sl_pct = _resolve(acfg.stop_loss_pct if acfg else None, config.stop_loss_pct)
            tp_pct = _resolve(acfg.take_profit_pct if acfg else None, config.take_profit_pct)

            base_size    = mismatch_position_size(mismatch, config)
            position_usd = max(min(round(base_size * (score / 100) * 0.5, 2),
                                   config.starting_capital * 0.30,
                                   config.available_cash), 5.0)
            if position_usd > config.available_cash:
                continue

            lbl, cat = _asset_meta(asset, signals)
            sl = round(cp * (1 - sl_pct/100), 6) if direction == "BUY" else round(cp * (1 + sl_pct/100), 6)
            tp = round(cp * (1 + tp_pct/100), 6) if direction == "BUY" else round(cp * (1 - tp_pct/100), 6)

            config.available_cash = round(config.available_cash - position_usd, 4)
            db.add(BotPositionDB(
                asset=asset, asset_label=lbl, category=cat, direction=direction,
                entry_price=cp, quantity_usd=position_usd,
                entry_signal_score=score if direction=="BUY" else -score,
                entry_reasoning=f"[MISMATCH={mismatch:.0f}{'★PM' if is_pm else ''}] {reasoning}",
                stop_loss_price=sl, take_profit_price=tp,
            ))
            db.add(BotTradeDB(
                asset=asset, asset_label=lbl, category=cat, action=direction,
                price=cp, quantity_usd=position_usd,
                signal_score=score if direction=="BUY" else -score,
                reasoning=f"[MISMATCH={mismatch:.0f}] {reasoning}", pnl=None,
            ))
            if is_pm and asset in premarket_assets:
                premarket_assets[asset].acted_on = True
            position_count += 1
            logger.info("BOT | %-4s %-12s $%.2f @ %.4f  score=%.0f  mismatch=%.0f%s",
                        direction, asset, position_usd, cp, score, mismatch, " ★PM" if is_pm else "")

        db.commit()
        all_pos     = db.query(BotPositionDB).all()
        pos_value   = sum(p.quantity_usd * (1 + _pnl_pct(p, prices[p.asset]["price"]) / 100)
                         for p in all_pos if p.asset in prices)
        logger.info("BOT | ── cycle end ──  cash=$%.2f  positions=%d  total=$%.2f",
                    config.available_cash, len(all_pos), round(config.available_cash + pos_value, 2))

    except Exception as e:
        logger.error("BOT | %s", e, exc_info=True)
        db.rollback()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 2. Sniper bot cycle
# ---------------------------------------------------------------------------

def run_sniper_cycle():
    db = SessionLocal()
    try:
        sniper_cfg = get_or_create_sniper_config(db)
        if not sniper_cfg.enabled:
            return

        global_cfg = get_or_create_config(db)
        now        = datetime.utcnow()
        prices     = fetch_prices()
        if not prices:
            return

        signals = db.query(SignalDB).filter(SignalDB.created_at >= now - timedelta(hours=12)).all()
        all_pos = db.query(BotPositionDB).all()

        sniper_count = sum(1 for p in all_pos if p.entry_reasoning and SNIPER_TAG in p.entry_reasoning)
        if sniper_count >= sniper_cfg.max_sniper_positions:
            return

        open_assets = {p.asset for p in all_pos}
        asset_set   = {ms["asset"] for sig in signals for ms in (sig.market_signals or []) if ms.get("asset")}

        for asset in asset_set:
            if sniper_count >= sniper_cfg.max_sniper_positions:
                break
            if asset in open_assets or asset not in prices:
                continue

            acfg = get_asset_config(asset, db)
            if acfg and not acfg.enabled:
                continue

            score, reasoning = compute_asset_score(asset, signals, now)
            abs_score  = abs(score)
            min_score  = _resolve(acfg.min_signal_score if acfg else None, sniper_cfg.min_signal_score)

            if abs_score < min_score:
                continue

            direction = "BUY" if score > 0 else "SELL"
            mismatch  = compute_mismatch_score(score, direction, prices[asset].get("change_pct", 0))

            if mismatch < sniper_cfg.mismatch_threshold:
                continue

            cp = prices[asset]["price"]
            if cp <= 0:
                continue

            position_usd = min(global_cfg.starting_capital * sniper_cfg.position_pct / 100,
                                global_cfg.available_cash)
            if position_usd < 5.0:
                continue

            sl_pct = _resolve(acfg.stop_loss_pct if acfg else None, global_cfg.stop_loss_pct)
            tp_pct = _resolve(acfg.take_profit_pct if acfg else None, global_cfg.take_profit_pct)

            sl = round(cp * (1 - sl_pct/100), 6) if direction == "BUY" else round(cp * (1 + sl_pct/100), 6)
            tp = round(cp * (1 + tp_pct/100), 6) if direction == "BUY" else round(cp * (1 - tp_pct/100), 6)
            lbl, cat = _asset_meta(asset, signals)
            action   = "SNIPER_BUY" if direction == "BUY" else "SNIPER_SELL"

            global_cfg.available_cash = round(global_cfg.available_cash - position_usd, 4)
            db.add(BotPositionDB(
                asset=asset, asset_label=lbl, category=cat, direction=direction,
                entry_price=cp, quantity_usd=position_usd,
                entry_signal_score=score if direction=="BUY" else -score,
                entry_reasoning=f"{SNIPER_TAG} [MISMATCH={mismatch:.0f}] score={abs_score:.0f} {reasoning}",
                stop_loss_price=sl, take_profit_price=tp,
            ))
            db.add(BotTradeDB(
                asset=asset, asset_label=lbl, category=cat, action=action,
                price=cp, quantity_usd=position_usd,
                signal_score=score if direction=="BUY" else -score,
                reasoning=f"{SNIPER_TAG} [MISMATCH={mismatch:.0f}] {reasoning}", pnl=None,
            ))
            open_assets.add(asset)
            sniper_count += 1
            logger.info("SNIPER | %-4s %-12s $%.2f @ %.4f  mismatch=%.0f  score=%.0f",
                        action, asset, position_usd, cp, mismatch, abs_score)

        db.commit()
    except Exception as e:
        logger.error("SNIPER | %s", e, exc_info=True)
        db.rollback()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 3. Grid bot cycle
# ---------------------------------------------------------------------------

def _initialize_grid_orders(bot: GridBotDB, db):
    """Create initial OPEN limit orders for a new grid."""
    for lvl in range(-bot.num_levels, bot.num_levels + 1):
        if lvl == 0:
            continue
        direction = "BUY" if lvl < 0 else "SELL"
        price = round(bot.base_price * (1 + lvl * bot.grid_spacing_pct / 100), 6)
        db.add(GridOrderDB(
            grid_bot_id=bot.id, asset=bot.asset,
            level=lvl, price=price, direction=direction, status="OPEN",
        ))


def run_grid_cycle():
    db = SessionLocal()
    try:
        bots = db.query(GridBotDB).filter_by(enabled=True).all()
        if not bots:
            return

        prices = fetch_prices()
        if not prices:
            return

        now = datetime.utcnow()
        for bot in bots:
            pd = prices.get(bot.asset)
            if not pd:
                continue
            cp = pd["price"]

            open_orders = db.query(GridOrderDB).filter_by(grid_bot_id=bot.id, status="OPEN").all()
            open_levels = {o.level: o for o in open_orders}

            for order in open_orders:
                filled = (order.direction == "BUY" and cp <= order.price) or \
                         (order.direction == "SELL" and cp >= order.price)
                if not filled:
                    continue

                order.status       = "FILLED"
                order.filled_price = cp
                order.filled_at    = now

                if order.direction == "BUY":
                    order.pnl    = 0.0
                    paired_level = order.level + 1
                    if paired_level not in open_levels:
                        paired_price = round(bot.base_price * (1 + paired_level * bot.grid_spacing_pct / 100), 6)
                        new = GridOrderDB(grid_bot_id=bot.id, asset=bot.asset,
                                          level=paired_level, price=paired_price,
                                          direction="SELL", status="OPEN")
                        db.add(new); open_levels[paired_level] = new
                else:
                    pair_pnl      = round(bot.capital_per_level * bot.grid_spacing_pct / 100, 4)
                    order.pnl     = pair_pnl
                    bot.total_pnl = round(bot.total_pnl + pair_pnl, 4)
                    paired_level  = order.level - 1
                    if paired_level != 0 and paired_level not in open_levels:
                        paired_price = round(bot.base_price * (1 + paired_level * bot.grid_spacing_pct / 100), 6)
                        new = GridOrderDB(grid_bot_id=bot.id, asset=bot.asset,
                                          level=paired_level, price=paired_price,
                                          direction="BUY", status="OPEN")
                        db.add(new); open_levels[paired_level] = new

                logger.info("GRID | %-4s %-12s  level=%+d  price=%.4f  pnl=$%.4f",
                            order.direction, bot.asset, order.level, cp, order.pnl or 0)

        db.commit()
    except Exception as e:
        logger.error("GRID | %s", e, exc_info=True)
        db.rollback()
    finally:
        db.close()
