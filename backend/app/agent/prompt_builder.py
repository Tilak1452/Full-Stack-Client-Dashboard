"""
FinSight AI — Dynamic Prompt Builder v2.0
Assembles query-intent-aware prompts at runtime.

Key improvements over v1:
- output_mode detection routes each query to a different response structure
- Original user query is always injected at the top of the prompt
- Pre-computed verdicts are removed — the LLM reasons from raw data
- Technical annotations are contextual (warnings, highlights, alerts)
- build_news_prompt() and build_general_prompt() added for other nodes
"""

from typing import Optional


# ---------------------------------------------------------------------------
# OUTPUT MODE DETECTION — routes analyst to the right response structure
# ---------------------------------------------------------------------------

def detect_output_mode(query: str) -> str:
    """
    Classifies the user's query into one of 5 output modes.
    Each mode produces a completely different response structure from the LLM.

    Returns one of:
        "trade_plan"         — User wants entry/SL/target numbers
        "technical_deep_dive"— User asking about specific indicators
        "news_catalyst"      — User asking why price moved / what happened
        "price_check"        — User just wants current price/status
        "general_outlook"    — User wants overall view of the stock
    """
    q = query.lower()

    # Trade plan signals — highest priority
    if any(w in q for w in [
        "buy", "sell", "trade", "entry", "setup", "invest", "position",
        "kharidna", "bechna", "kharidein", "lagaun", "should i", "kya karu",
        "long", "short", "target", "stop loss", "stop-loss", "sl", "tp"
    ]):
        return "trade_plan"

    # Technical deep dive
    if any(w in q for w in [
        "rsi", "macd", "sma", "ema", "bollinger", "technical", "indicator",
        "overbought", "oversold", "divergence", "momentum", "volume",
        "support", "resistance", "trend", "breakout", "breakdown"
    ]):
        return "technical_deep_dive"

    # News catalyst — why did it move
    if any(w in q for w in [
        "news", "why", "reason", "what happened", "catalyst", "kyun", "kyu",
        "fell", "crashed", "surged", "jumped", "drop", "rise", "rally",
        "results", "earnings", "quarter", "q1", "q2", "q3", "q4"
    ]):
        return "news_catalyst"

    # Quick price check
    if any(w in q for w in [
        "price", "rate", "current", "now", "today price", "kitna hai",
        "share price", "stock price", "worth", "value"
    ]) and not any(w in q for w in ["should", "analysis", "outlook", "view"]):
        return "price_check"

    # Default — general outlook
    return "general_outlook"


def detect_complexity(query: str) -> str:
    """Detects user's financial literacy level from query phrasing."""
    q = query.lower()
    advanced_terms = [
        "ev/ebitda", "dcf", "wacc", "beta", "alpha", "sharpe", "sortino",
        "implied volatility", "put-call ratio", "open interest", "derivatives",
        "futures", "options", "theta", "delta", "gamma", "fibonacci retracement",
        "elliott wave", "wyckoff", "accumulation", "distribution"
    ]
    beginner_signals = [
        "what is", "explain", "kya hota", "matlab", "means", "simple",
        "beginner", "new to", "first time", "should i", "safe hai"
    ]
    if any(t in q for t in advanced_terms):
        return "advanced"
    if any(t in q for t in beginner_signals):
        return "beginner"
    return "intermediate"


def detect_general_response_mode(query: str) -> str:
    """Detects if a general query is educational, advisory, or macro."""
    q = query.lower()
    advisory_signals = [
        "should i", "is it safe", "will i", "good time", "worth it",
        "buy gold", "invest in", "crypto safe", "kya karu", "lagaun",
        "is bitcoin", "is gold", "should i buy"
    ]
    macro_signals = [
        "war", "inflation", "rbi", "fed", "interest rate", "gdp", "tariff",
        "geopolitical", "china", "us market", "global", "recession", "oil price",
        "effect of", "impact of", "india pakistan"
    ]
    if any(s in q for s in advisory_signals):
        return "advisory"
    if any(s in q for s in macro_signals):
        return "macro"
    return "educational"


# ---------------------------------------------------------------------------
# ANALYST PROMPT BUILDER
# ---------------------------------------------------------------------------

def build_analyst_prompt(
    symbol: str,
    stock_data: dict,
    technicals: dict,
    news: list,
    setup: dict,
    structure: dict,
    original_query: str,
    compare_data: list = None,
) -> str:
    """
    Builds a fully dynamic analyst prompt. Every section is conditional —
    only included if real data exists for it.

    v2: output_mode routes the response structure; pre-computed verdict removed.
    """
    parts = []
    output_mode = detect_output_mode(original_query)

    # --- Always inject the user's exact question first ---
    parts.append(f'## User\'s Question: "{original_query}"')
    parts.append(
        f"**Focus your entire response on directly answering this question "
        f"using only the data below. Output mode: `{output_mode}`.**\n"
    )

    # --- Core price data ---
    price     = stock_data.get("current_price")
    prev      = stock_data.get("previous_close")
    day_high  = stock_data.get("day_high")
    day_low   = stock_data.get("day_low")
    mkt_cap   = stock_data.get("market_cap")
    pe        = stock_data.get("pe_ratio")
    exchange  = stock_data.get("exchange", "NSE")
    change_pct = round(((price - prev) / prev) * 100, 2) if price and prev else None

    parts.append(f"## {symbol} — Live Snapshot ({exchange})")
    if price:
        direction = "▲" if change_pct and change_pct > 0 else "▼"
        chg_str   = f"{direction} {abs(change_pct)}% today" if change_pct is not None else ""
        parts.append(f"**Current Price:** ₹{price:,.2f}  {chg_str}")
    if day_high and day_low:
        day_range_pct = round(((day_high - day_low) / day_low) * 100, 2) if day_low else None
        parts.append(f"**Day Range:** ₹{day_low:,.2f} → ₹{day_high:,.2f}  (range: {day_range_pct}%)")
    if price and prev and change_pct is not None:
        abs_change = round(price - prev, 2)
        parts.append(f"**Change vs Close:** ₹{abs_change:+.2f} ({change_pct:+.2f}%)")
    if pe:
        parts.append(f"**P/E Ratio:** {pe}x")
    if mkt_cap:
        cap_cr = round(mkt_cap / 1e7, 0)
        parts.append(f"**Market Cap:** ₹{cap_cr:,.0f} Cr")

    # --- Technical Picture (enriched with contextual warnings) ---
    rsi      = technicals.get("rsi")
    macd     = technicals.get("macd")
    macd_sig = technicals.get("macd_signal")
    sma20    = technicals.get("sma_20")
    sma50    = technicals.get("sma_50")
    bb_upper = technicals.get("bollinger_upper")
    bb_lower = technicals.get("bollinger_lower")
    vol_ratio = technicals.get("volume_ratio")
    atr      = technicals.get("atr")
    ema20    = technicals.get("ema_20")

    tech_lines = []

    # RSI with contextual alerts
    if rsi:
        rsi_r = round(rsi, 1)
        if rsi > 80:
            zone = f"🔴 Extremely Overbought ({rsi_r}) — HIGH risk of reversal, do not chase"
        elif rsi > 70:
            zone = f"🔴 Overbought ({rsi_r}) — momentum weakening, watch for rejection near resistance"
        elif rsi > 65:
            zone = f"🟠 Approaching Overbought Zone ({rsi_r}) — cautious, watch for stall"
        elif rsi < 20:
            zone = f"🟢 Extremely Oversold ({rsi_r}) — strong mean reversion potential, but confirm with volume"
        elif rsi < 30:
            zone = f"🟢 Oversold ({rsi_r}) — potential bounce zone, look for bullish reversal candle"
        elif rsi < 35:
            zone = f"🟡 Near Oversold ({rsi_r}) — weak, but not yet in recovery zone"
        else:
            zone = f"🟡 Neutral ({rsi_r}) — no extreme reading"
        tech_lines.append(f"- RSI: {zone}")

        # Divergence check
        if price and day_high and rsi < 65 and price >= day_high * 0.98:
            tech_lines.append(
                f"  ⚠️ POTENTIAL BEARISH DIVERGENCE: Price near day-high ₹{day_high} "
                f"while RSI is at {rsi_r} (not confirming strength)"
            )
        elif price and day_low and rsi > 35 and price <= day_low * 1.02:
            tech_lines.append(
                f"  💡 POTENTIAL BULLISH DIVERGENCE: Price near day-low ₹{day_low} "
                f"while RSI is at {rsi_r} (recovering — watch for reversal)"
            )

    # MACD with crossover context
    if macd is not None and macd_sig is not None:
        m_r = round(macd, 4)
        s_r = round(macd_sig, 4)
        gap = round(abs(macd - macd_sig), 4)
        if macd > macd_sig:
            crossover = "Bullish crossover active" if gap > 0.05 else "Weak bullish — histogram shrinking"
            tech_lines.append(f"- MACD: {m_r} > Signal {s_r} → 📈 {crossover}")
        else:
            crossover = "Bearish crossover active" if gap > 0.05 else "Weak bearish — potential reversal forming"
            tech_lines.append(f"- MACD: {m_r} < Signal {s_r} → 📉 {crossover}")

    # Price vs SMA20 with context
    if sma20 and price:
        sma20_r = round(sma20, 2)
        gap_pct = round(((price - sma20) / sma20) * 100, 1)
        if price > sma20:
            note = "Extended above — possible pullback to SMA20" if gap_pct > 5 else "Clean uptrend structure"
            tech_lines.append(f"- Price vs SMA20: ₹{price} vs ₹{sma20_r} (+{gap_pct}%) → 📈 {note}")
        else:
            note = "Severely below — strong downtrend" if gap_pct < -8 else "Below SMA20 — bearish structure"
            tech_lines.append(f"- Price vs SMA20: ₹{price} vs ₹{sma20_r} ({gap_pct}%) → 📉 {note}")

    if sma50 and price:
        sma50_r = round(sma50, 2)
        rel50 = "above" if price > sma50 else "below"
        gap50 = round(((price - sma50) / sma50) * 100, 1)
        tech_lines.append(f"- Price vs SMA50: ₹{sma50_r} ({'+' if gap50 > 0 else ''}{gap50}%) — medium-term {rel50}")

    # Bollinger Bands
    if bb_upper and bb_lower and price:
        bb_u_r = round(bb_upper, 2)
        bb_l_r = round(bb_lower, 2)
        bandwidth = round(((bb_upper - bb_lower) / ((bb_upper + bb_lower) / 2)) * 100, 1)
        if price > bb_upper:
            tech_lines.append(
                f"- Bollinger Bands: Price ₹{price} ABOVE upper band ₹{bb_u_r} → "
                f"⚠️ Overextended, mean reversion risk (bandwidth: {bandwidth}%)"
            )
        elif price < bb_lower:
            tech_lines.append(
                f"- Bollinger Bands: Price ₹{price} BELOW lower band ₹{bb_l_r} → "
                f"💡 Extreme compression, bounce candidate (bandwidth: {bandwidth}%)"
            )
        else:
            position_pct = round(((price - bb_lower) / (bb_upper - bb_lower)) * 100, 0)
            tech_lines.append(
                f"- Bollinger Bands: ₹{bb_l_r} – ₹{bb_u_r} | Price at {position_pct}% of band "
                f"(bandwidth: {bandwidth}%)"
            )

    # Volume
    if vol_ratio:
        vol_r = round(vol_ratio, 2)
        if vol_ratio > 2.5:
            vol_note = f"🔥 EXTREME volume ({vol_r}x avg) — major institutional activity, breakout/breakdown possible"
        elif vol_ratio > 1.5:
            vol_note = f"📊 HIGH volume ({vol_r}x avg) — institutional interest, move likely real"
        elif vol_ratio < 0.6:
            vol_note = f"💤 LOW volume ({vol_r}x avg) — weak conviction, treat any move with skepticism"
        else:
            vol_note = f"Volume: {vol_r}x average — normal activity"
        tech_lines.append(f"- {vol_note}")

    # ATR
    if atr and price:
        atr_r    = round(atr, 2)
        atr_pct  = round((atr / price) * 100, 2)
        tech_lines.append(
            f"- ATR (Daily Volatility): ₹{atr_r} ({atr_pct}% of price) — "
            f"expected daily swing range"
        )

    if tech_lines:
        parts.append("\n### Technical Picture")
        parts.extend(tech_lines)
    else:
        parts.append("\n### Technical Picture")
        parts.append("- Technical data unavailable. Analysis based on price action only.")

    # --- Market Structure ---
    if structure and structure.get("trend"):
        parts.append("\n### Market Structure")
        trend = structure["trend"]
        bias  = structure.get("trader_bias", "")
        parts.append(f"- **Trend:** {trend}  |  **Bias:** {bias}")
        if structure.get("key_resistance"):
            dist_r = structure.get("distance_to_resistance", "?")
            parts.append(f"- 🔴 Key Resistance: ₹{structure['key_resistance']} ({dist_r} away)")
        if structure.get("key_support"):
            dist_s = structure.get("distance_to_support", "?")
            parts.append(f"- 🟢 Key Support: ₹{structure['key_support']} ({dist_s} away)")

    # --- News (conditional + richer) ---
    if news and len(news) > 0:
        parts.append("\n### Recent News")
        sentiments = [a.get("sentiment", "neutral") for a in news]
        pos  = sentiments.count("positive")
        neg  = sentiments.count("negative")
        neu  = sentiments.count("neutral")
        if pos > neg:
            overall_news = f"🟢 Bullish bias ({pos} positive, {neg} negative, {neu} neutral)"
        elif neg > pos:
            overall_news = f"🔴 Bearish bias ({neg} negative, {pos} positive, {neu} neutral)"
        else:
            overall_news = f"🟡 Mixed sentiment ({pos} positive, {neg} negative, {neu} neutral)"
        parts.append(f"- **News Tone:** {overall_news} across {len(news)} recent articles")
        for i, article in enumerate(news[:3]):
            sentiment_icon = "📈" if article.get("sentiment") == "positive" else (
                "📉" if article.get("sentiment") == "negative" else "📰"
            )
            parts.append(
                f"- {sentiment_icon} {article.get('title', 'N/A')} "
                f"[{article.get('source', '?')} • {article.get('published_at', '')}]"
            )
    else:
        parts.append("\n### News")
        parts.append("- No recent news found. Analysis based entirely on technical data.")

    # --- Trade Setup (conditional) ---
    if setup and setup.get("name") and setup.get("name") != "No Clear Setup":
        parts.append("\n### Detected Trading Setup")
        parts.append(f"**{setup['name']}** — Confidence: {setup.get('confidence', '?')}")
        if setup.get("entry"):
            parts.append(f"- Entry Zone: ₹{setup['entry']}")
        if setup.get("stop_loss"):
            parts.append(f"- Stop Loss: ₹{setup['stop_loss']}")
        if setup.get("target_1"):
            parts.append(f"- Target 1: ₹{setup['target_1']} | Target 2: ₹{setup.get('target_2', '?')}")
        if setup.get("risk_reward"):
            parts.append(f"- Risk/Reward: {setup['risk_reward']}")
        if setup.get("reasoning"):
            parts.append(f"- Setup Logic: {setup['reasoning']}")
        parts.append("- **Position sizing:** Risk max 1–2% of capital on this trade.")
    elif output_mode == "trade_plan":
        parts.append("\n### Trade Setup Status")
        parts.append("- ⚠️ No high-probability setup detected in current data.")
        if structure and structure.get("key_support"):
            parts.append(
                f"- Watch ₹{structure['key_support']} as a potential entry zone on a pullback with volume confirmation."
            )
        parts.append("- Recommendation: Wait for a cleaner signal before entering.")

    # --- Compare Data (conditional) ---
    if compare_data and len(compare_data) > 1:
        parts.append("\n### Peer Comparison Data")
        for idx, comp in enumerate(compare_data):
            comp_sym = comp.get("symbol", f"Stock {idx+1}")
            comp_price = comp.get("stock_data", {}).get("current_price", "N/A")
            comp_pe = comp.get("fundamentals", {}).get("pe_ratio", "N/A")
            comp_rsi = comp.get("technicals", {}).get("rsi_14", "N/A")
            if isinstance(comp_rsi, float): comp_rsi = round(comp_rsi, 1)
            parts.append(f"**{comp_sym}**: Price: ₹{comp_price} | P/E: {comp_pe}x | RSI: {comp_rsi}")

    # --- Output Mode Instruction (this is what powers dynamic responses) ---
    parts.append("\n---")
    parts.append(_get_mode_instruction(output_mode, symbol, original_query, has_compare=(compare_data is not None and len(compare_data) > 1)))

    return "\n".join(parts)


def _get_mode_instruction(output_mode: str, symbol: str, original_query: str, has_compare: bool = False) -> str:
    """Returns the specific LLM output instruction for each query mode."""
    if has_compare:
        return (
            f"## Your Task: COMPARISON ANALYSIS\n"
            f"The user asked: '{original_query}'\n"
            f"You are comparing multiple stocks. Structure your response clearly:\n"
            f"**1. The Winner:** Start with a 1-sentence verdict on which stock is the better buy right now.\n"
            f"**2. Key Differences:** Use bullet points to contrast their Valuations (P/E) and Technicals (RSI).\n"
            f"**3. Trade Outlook:** Give a brief outlook on the primary stock vs the peers.\n"
            f"Use proper markdown formatting, bold text for symbols, and clean bulleted lists.\n"
            f"Tone: Senior analyst comparing equities. Be decisive.\n"
            f"Length: 150-250 words."
        )

    instructions = {
        "trade_plan": (
            f"## Your Task: TRADE PLAN\n"
            f"The user asked: '{original_query}'\n"
            f"Lead with a 1-sentence directional verdict. Then go straight into the numbers:\n"
            f"- **Entry:** ...\n"
            f"- **Stop Loss:** ...\n"
            f"- **Targets:** ...\n"
            f"- **Risk/Reward:** ...\n"
            f"Close with 2 bullet points: what would INVALIDATE this setup.\n"
            f"Format strictly with markdown bullet points and bold headers.\n"
            f"Tone: Trading desk. Fast. Concrete. Every sentence contains a price level or percentage.\n"
            f"Length: 150-250 words. No general market philosophy."
        ),
        "technical_deep_dive": (
            f"## Your Task: TECHNICAL ANALYSIS\n"
            f"The user asked: '{original_query}'\n"
            f"Walk through each indicator from the data above using a markdown bulleted list.\n"
            f"For each indicator, state the value, what it means RIGHT NOW, and if it's confirming or contradicting the others.\n"
            f"Check for divergences between price action and momentum indicators.\n"
            f"Conclude with a technical verdict: **BULLISH / BEARISH / NEUTRAL** and the 2 strongest signals driving it.\n"
            f"Tone: Analyst note. Precise. Reference every number shown above.\n"
            f"Length: 200-300 words."
        ),
        "news_catalyst": (
            f"## Your Task: NEWS CATALYST ANALYSIS\n"
            f"The user asked: '{original_query}'\n"
            f"Lead with the single most impactful headline from the data above.\n"
            f"Explain: Is this a price-moving event or noise? Does it confirm or contradict the technical picture?\n"
            f"Then give the combined verdict: how does news + technicals together change the outlook?\n"
            f"Tone: Financial journalist meets analyst. Lead with the story, support with data.\n"
            f"Length: 120-200 words."
        ),
        "price_check": (
            f"## Your Task: QUICK STATUS CHECK\n"
            f"The user asked: '{original_query}'\n"
            f"Give a concise, punchy status update for {symbol}:\n"
            f"Line 1: Current price, day change, and direction.\n"
            f"Line 2: One-line technical read (RSI + trend structure).\n"
            f"Line 3: The single most important price level to watch (support or resistance).\n"
            f"Line 4: One headline from today's news (if available).\n"
            f"Tone: Bloomberg terminal ticker. Maximum density, minimum words.\n"
            f"Length: 50-80 words maximum."
        ),
        "general_outlook": (
            f"## Your Task: STOCK OUTLOOK\n"
            f"The user asked: '{original_query}'\n"
            f"Give a balanced, complete picture of where {symbol} stands right now:\n"
            f"1. What is the price doing (trend + momentum)?\n"
            f"2. What do the key risk levels say (support/resistance proximity)?\n"
            f"3. What is the news backdrop telling us?\n"
            f"4. Your overall bias: BULLISH / BEARISH / NEUTRAL — with the top 2 reasons.\n"
            f"5. One-line 'Watch For': the single event or price level that would change this view.\n"
            f"Tone: Senior fund manager. Balanced. Thoughtful. Direct.\n"
            f"Length: 180-250 words."
        )
    }
    return instructions.get(output_mode, instructions["general_outlook"])


# ---------------------------------------------------------------------------
# NEWS PROMPT BUILDER
# ---------------------------------------------------------------------------

def build_news_prompt(
    articles: list,
    original_query: str,
    query_mode: str = "narrative",
) -> str:
    """
    Builds a query-aware news synthesis prompt.

    query_mode:
        "narrative" — user asked a conversational question, returns prose
        "dashboard" — system call for dashboard widget, returns JSON
    """
    q = original_query.lower() if original_query else ""

    # Detect specific focus areas in the query
    wants_fii        = any(w in q for w in ["fii", "dii", "foreign", "institutional", "flow"])
    wants_sector     = any(w in q for w in ["sector", "it", "bank", "pharma", "auto", "metal", "nifty"])
    wants_catalyst   = any(w in q for w in ["why", "reason", "fell", "crashed", "surged", "jumped", "catalyst"])

    focus_instruction = ""
    if wants_fii:
        focus_instruction = "\n**PRIORITY FOCUS:** Extract all FII/DII flow signals from the articles above all else."
    elif wants_sector:
        focus_instruction = "\n**PRIORITY FOCUS:** Identify sector-specific themes. Which sectors are gaining/losing? Any rotation evidence?"
    elif wants_catalyst:
        focus_instruction = "\n**PRIORITY FOCUS:** Identify the single event or catalyst driving price movement. Lead with causality."

    articles_block = f"Articles ({len(articles)} total):\n"
    for i, a in enumerate(articles[:15], 1):
        articles_block += (
            f"{i}. [{a.get('sentiment', 'neutral').upper()}] {a.get('title', 'N/A')} "
            f"— {a.get('source', '?')} ({a.get('published_at', '')})\n"
        )

    if query_mode == "narrative":
        return (
            f'User\'s Question: "{original_query}"\n\n'
            f"{articles_block}\n"
            f"{focus_instruction}\n\n"
            f"Write a direct, Bloomberg Intelligence-style prose answer to the user's question above.\n"
            f"Do NOT output JSON. Write narrative paragraphs.\n"
            f"Lead with the most impactful data point — a specific number, company, or event.\n"
            f"NEVER start with 'The market' or 'Markets showed'.\n"
            f"Length: 100-180 words. Cite specific article titles when referencing a story.\n"
            f"Conclude with: **Overall Mood:** [BULLISH / BEARISH / NEUTRAL] — [one-sentence reason]"
        )
    else:
        # JSON mode for dashboard widget
        return (
            f'Context: Dashboard news widget call.\n\n'
            f"{articles_block}\n"
            f"{focus_instruction}\n\n"
            f"Synthesize into the required JSON structure."
        )


# ---------------------------------------------------------------------------
# GENERAL EDUCATOR PROMPT BUILDER
# ---------------------------------------------------------------------------

def build_general_prompt(
    question: str,
    portfolio_context: str = "None provided",
) -> str:
    """
    Builds a query-aware prompt for the general educator node.
    Automatically selects response_mode and complexity_level.
    """
    response_mode    = detect_general_response_mode(question)
    complexity_level = detect_complexity(question)

    q = question.lower()

    # Word limits by complexity
    word_limits = {
        "beginner":     "100-150 words. No jargon. One simple analogy.",
        "intermediate": "150-250 words. Light technical language with brief in-line explanation.",
        "advanced":     "250-400 words. Full technical language permitted. No need to simplify."
    }
    word_limit = word_limits[complexity_level]

    mode_instructions = {
        "educational": (
            f"## Response Mode: EDUCATIONAL\n"
            f"Structure your answer as:\n"
            f"**[Concept Name]** _({complexity_level})_\n\n"
            f"**What It Is** — 2-3 sentences. Clear definition using Indian market context where possible.\n\n"
            f"**How It Works in Practice** — A real-world example from NSE/BSE markets.\n\n"
            f"**The Number You Should Know** — One key metric, threshold, or value related to this concept.\n\n"
            f"**Key Takeaway** — One actionable sentence the user can apply today.\n\n"
            f"**Explore Next:** — 2-3 related concepts as a comma-separated list.\n\n"
            f"Word limit: {word_limit}"
        ),
        "advisory": (
            f"## Response Mode: ADVISORY\n"
            f"The user is asking: '{question}'\n"
            f"Give a DIRECT advisory answer. Do not hedge excessively.\n\n"
            f"Structure:\n"
            f"**[Asset/Topic]** — **[BULLISH / BEARISH / NEUTRAL / CAUTION]**\n\n"
            f"**Why:** 3 specific, concrete reasons for your stance. Reference real market conditions.\n\n"
            f"**The Risk:** What could make this view wrong? One specific scenario.\n\n"
            f"**What To Do:** One clear, actionable sentence (not buy/sell, but positioning advice).\n\n"
            f"Tone: Direct financial advisor. Give a clear stance. Do not say 'it depends' without following with an actual answer.\n"
            f"Word limit: {word_limit}"
        ),
        "macro": (
            f"## Response Mode: MACRO / GEOPOLITICAL\n"
            f"The user is asking: '{question}'\n"
            f"Explain the financial impact using Indian market context.\n\n"
            f"Structure:\n"
            f"**[Event/Topic] — Market Impact**\n\n"
            f"**Immediate Effect:** What happens to Indian markets first (Nifty, Sensex, specific sectors).\n\n"
            f"**Sectors Most Affected:** Name specific NSE sectors and whether they benefit or suffer.\n\n"
            f"**FII/DII Behaviour:** How do institutional flows typically respond to this type of event?\n\n"
            f"**Trader's Takeaway:** One concrete action or observation the user can apply.\n\n"
            f"Tone: Analytical. Reference Indian indices, sectors, and flows specifically.\n"
            f"Word limit: {word_limit}"
        )
    }

    mode_instruction = mode_instructions.get(response_mode, mode_instructions["educational"])

    portfolio_block = ""
    if portfolio_context and portfolio_context != "None provided":
        portfolio_block = f"\n**User's Portfolio Context:** {portfolio_context}\nPersonalize your answer to this context where relevant.\n"

    return (
        f"User's Question: \"{question}\"\n"
        f"Detected Mode: {response_mode.upper()} | Complexity: {complexity_level.upper()}\n"
        f"{portfolio_block}\n"
        f"---\n"
        f"{mode_instruction}\n"
        f"\n**STRICT RULES:**\n"
        f"- Output plain markdown ONLY. No JSON. No code blocks.\n"
        f"- Start DIRECTLY with the bold header — NO intro sentence like 'Great question' or 'Here is my answer'.\n"
        f"- Use Indian Rupee (₹) for all amounts. Reference Indian market context (NSE, Sensex, Nifty).\n"
        f"- If the question is completely unrelated to finance, respond: "
        f"**Out of Scope** — FinSight AI covers stocks, portfolio management, and market research.\n"
    )
