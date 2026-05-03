"""IRT-lite ability (θ) and topic history for hybrid adaptive practice (used alongside tabular Q + UCB + linear TD)."""

from __future__ import annotations

import math
import random
from typing import Any, Dict, List, Optional, Set, Tuple


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-max(-20.0, min(20.0, x))))


def difficulty_b(diff: str) -> float:
    d = (diff or "medium").lower()
    if d == "easy":
        return -0.85
    if d == "hard":
        return 0.95
    return 0.0


def update_theta(theta: float, correct: bool, item_diff: str, lr: float = 0.42) -> float:
    """One-step 1PL-style update: y in {0,1}, expected = sigmoid(theta - b)."""
    b = difficulty_b(item_diff)
    y = 1.0 if correct else 0.0
    exp = sigmoid(theta - b)
    theta = theta + lr * (y - exp)
    return max(-3.0, min(3.0, theta))


def default_ability_state() -> Dict[str, Any]:
    return {
        "theta": 0.0,
        "topic_hist": {},
        "stratum_accuracy": {},
    }


def merge_ability_state(raw: Optional[dict]) -> Dict[str, Any]:
    base = default_ability_state()
    if isinstance(raw, dict):
        base.update(raw)
    if not isinstance(base.get("topic_hist"), dict):
        base["topic_hist"] = {}
    if not isinstance(base.get("stratum_accuracy"), dict):
        base["stratum_accuracy"] = {}
    return base


def topic_key(q: Dict[str, Any]) -> str:
    return str(q.get("taxonomy") or "understand")


def record_topic_outcome(state: Dict[str, Any], q: Dict[str, Any], correct: bool) -> None:
    tk = topic_key(q)
    hist = state.setdefault("topic_hist", {})
    cell = hist.get(tk) or {"n": 0, "c": 0}
    cell["n"] = int(cell.get("n", 0)) + 1
    if correct:
        cell["c"] = int(cell.get("c", 0)) + 1
    hist[tk] = cell
    # stratum = difficulty|taxonomy for psychometrics-lite bucket
    sk = f"{q.get('difficulty', 'medium')}|{tk}"
    acc = state.setdefault("stratum_accuracy", {})
    sc = acc.get(sk) or {"n": 0, "c": 0}
    sc["n"] = int(sc.get("n", 0)) + 1
    if correct:
        sc["c"] = int(sc.get("c", 0)) + 1
    acc[sk] = sc


def bank_id_boost_map(
    bank: List[Dict[str, Any]],
    used: Set[int],
    state: Dict[str, Any],
    explore_floor: float = 1.08,
) -> Dict[int, float]:
    """
    Higher boost for topics with low empirical accuracy (weak areas).
    Unused items in under-sampled topics get exploration boost.
    """
    hist = state.get("topic_hist") or {}
    boosts: Dict[int, float] = {}
    for q in bank:
        bid = int(q.get("bank_id", -1))
        if bid < 0 or bid in used:
            continue
        tk = topic_key(q)
        cell = hist.get(tk) or {"n": 0, "c": 0}
        n = int(cell.get("n", 0))
        c = int(cell.get("c", 0))
        if n < 4:
            boosts[bid] = explore_floor
            continue
        p = c / max(1, n)
        weakness = max(0.0, 0.62 - p)
        boosts[bid] = 1.0 + 0.85 * weakness
    return boosts


def weighted_choice_bid(rng: random.Random, bids: List[int], boosts: Dict[int, float]) -> int:
    if not bids:
        return -1
    if len(bids) == 1:
        return bids[0]
    ws = [max(0.05, float(boosts.get(b, 1.0))) for b in bids]
    t = sum(ws)
    r = rng.random() * t
    acc = 0.0
    for b, w in zip(bids, ws):
        acc += w
        if r <= acc:
            return b
    return bids[-1]
