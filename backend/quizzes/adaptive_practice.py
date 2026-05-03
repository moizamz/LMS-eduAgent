"""
Hybrid adaptive practice policy: tabular Q-learning + UCB1 multi-armed bandits,
with optional linear function approximation (TD(0)) as a lightweight DQN-style head.

Each arm is a (difficulty, Bloom taxonomy) pair matching Question.DIFFICULTY_CHOICES
and TAXONOMY_CHOICES. State encodes prior correctness, discretized time on the
previous item, and a short-term accuracy bin so transitions react to pace and mastery.

During a session, questions are drawn only from a pre-generated bank; the policy
selects which arm to pull next, then a random unused question from that stratum.
"""

from __future__ import annotations

import math
import random
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

DIFFICULTIES: Tuple[str, ...] = ("easy", "medium", "hard")
TAXONOMIES: Tuple[str, ...] = (
    "remember",
    "understand",
    "apply",
    "analyze",
    "evaluate",
    "create",
)
N_D = len(DIFFICULTIES)
N_T = len(TAXONOMIES)
N_ARMS = N_D * N_T  # 18
N_PREV = 3  # wrong, correct, none (session start)
N_TIME = 3  # fast, medium, slow
N_ACC = 3  # low, mid, high (session rolling accuracy)
N_STATES = N_PREV * N_TIME * N_ACC  # 27

# Q-learning / bandit hyperparameters (tunable without schema migration)
GAMMA = 0.92
ALPHA_Q = 0.35
LR_LIN = 0.08
UCB_C = 1.2
# Blend tabular Q, linear TD head, and UCB exploration (sums to 1.0)
W_TABULAR = 0.45
W_LINEAR = 0.25
W_UCB = 0.30
FEATURE_DIM = N_STATES + N_ARMS


def arm_index(difficulty: str, taxonomy: str) -> int:
    d = DIFFICULTIES.index(difficulty) if difficulty in DIFFICULTIES else 1
    t = TAXONOMIES.index(taxonomy) if taxonomy in TAXONOMIES else 1
    return d * N_T + t


def _norm_diff(tax: str) -> str:
    return tax if tax in TAXONOMIES else "understand"


def _norm_dif(dif: str) -> str:
    return dif if dif in DIFFICULTIES else "medium"


def normalize_question(q: Dict[str, Any], bid: int) -> Dict[str, Any]:
    out = dict(q)
    out["difficulty"] = _norm_dif(str(out.get("difficulty") or "medium"))
    out["taxonomy"] = _norm_diff(str(out.get("taxonomy") or "understand"))
    out["bank_id"] = bid
    return out


def time_bucket(seconds: Optional[float]) -> int:
    """0=fast, 1=medium, 2=slow (supports 'time on question' signals)."""
    if seconds is None:
        return 1
    try:
        s = float(seconds)
    except (TypeError, ValueError):
        return 1
    if s < 45.0:
        return 0
    if s <= 120.0:
        return 1
    return 2


def accuracy_bucket(correct_so_far: int, total_so_far: int) -> int:
    if total_so_far <= 0:
        return 1
    r = correct_so_far / max(1, total_so_far)
    if r < 0.45:
        return 0
    if r < 0.75:
        return 1
    return 2


def pack_state(prev_correct: int, time_b: int, acc_b: int) -> int:
    """
    prev_correct: 0=wrong, 1=correct, 2=no prior (session start / first question)
    """
    prev_correct = 0 if prev_correct < 1 else (1 if prev_correct == 1 else 2)
    time_b = max(0, min(N_TIME - 1, time_b))
    acc_b = max(0, min(N_ACC - 1, acc_b))
    return prev_correct * (N_TIME * N_ACC) + time_b * N_ACC + acc_b


def phi_sa(state_id: int, arm: int) -> List[float]:
    vec = [0.0] * FEATURE_DIM
    vec[max(0, min(N_STATES - 1, state_id))] = 1.0
    vec[N_STATES + max(0, min(N_ARMS - 1, arm))] = 1.0
    return vec


def dot(a: Sequence[float], b: Sequence[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def q_linear(state_id: int, arm: int, weights: Sequence[float]) -> float:
    if len(weights) != FEATURE_DIM:
        return 0.0
    return dot(weights, phi_sa(state_id, arm))


def max_q_linear(state_id: int, weights: Sequence[float]) -> float:
    return max(q_linear(state_id, a, weights) for a in range(N_ARMS))


def td_update_lin(
    w: List[float],
    s: int,
    a: int,
    r: float,
    s_next: int,
    gamma: float = GAMMA,
    lr: float = LR_LIN,
) -> None:
    """Single-step semi-gradient Q-learning with linear value fn (DQN-style head without replay)."""
    if len(w) != FEATURE_DIM:
        return
    ph = phi_sa(s, a)
    current = dot(w, ph)
    target = r + gamma * max_q_linear(s_next, w)
    delta = target - current
    for i in range(FEATURE_DIM):
        w[i] += lr * delta * ph[i]


def arm_key(arm: int) -> str:
    return str(int(arm))


def get_q_tab(q_table: Dict[str, float], s: int, a: int) -> float:
    return float(q_table.get(f"{int(s)}|{int(a)}", 0.0))


def set_q_tab(q_table: Dict[str, float], s: int, a: int, value: float) -> None:
    q_table[f"{int(s)}|{int(a)}"] = float(value)


def q_learning_update(
    q_table: Dict[str, float],
    s: int,
    a: int,
    r: float,
    s_next: int,
    alpha: float = ALPHA_Q,
    gamma: float = GAMMA,
) -> None:
    old = get_q_tab(q_table, s, a)
    max_next = max(get_q_tab(q_table, s_next, ap) for ap in range(N_ARMS))
    new = old + alpha * (r + gamma * max_next - old)
    set_q_tab(q_table, s, a, new)


def bandit_update(bandit: Dict[str, Dict[str, float]], arm: int, reward: float) -> None:
    k = arm_key(arm)
    cell = bandit.get(k) or {"n": 0.0, "sum_r": 0.0}
    cell["n"] = float(cell.get("n", 0.0)) + 1.0
    cell["sum_r"] = float(cell.get("sum_r", 0.0)) + float(reward)
    bandit[k] = cell


def ucb_values(bandit: Dict[str, Dict[str, float]], total_pulls: int) -> List[float]:
    scores = []
    t = max(1, int(total_pulls))
    log_t = math.log(t + 1.0)
    for a in range(N_ARMS):
        cell = bandit.get(arm_key(a)) or {}
        n = float(cell.get("n", 0.0))
        if n <= 0.0:
            scores.append(float("inf"))
            continue
        mean = float(cell.get("sum_r", 0.0)) / n
        bonus = UCB_C * math.sqrt(log_t / n)
        scores.append(mean + bonus)
    return scores


def _normalize_scores(vals: List[float]) -> List[float]:
    finite = [v for v in vals if not math.isinf(v)]
    if not finite:
        return [0.0] * len(vals)
    lo, hi = min(finite), max(finite)
    if hi - lo < 1e-6:
        return [0.0 for _ in vals]
    out = []
    for v in vals:
        if math.isinf(v):
            out.append(1.0)
        else:
            out.append((v - lo) / (hi - lo))
    return out


def build_unused_by_arm(
    bank: List[Dict[str, Any]], used: Set[int]
) -> Dict[int, List[int]]:
    out: Dict[int, List[int]] = {a: [] for a in range(N_ARMS)}
    for q in bank:
        bid = int(q.get("bank_id", -1))
        if bid < 0 or bid in used:
            continue
        arm = arm_index(str(q.get("difficulty", "medium")), str(q.get("taxonomy", "understand")))
        out[arm].append(bid)
    return out


def select_next_bank_id(
    state_id: int,
    q_table: Dict[str, float],
    bandit: Dict[str, Dict[str, float]],
    weights: List[float],
    bank: List[Dict[str, Any]],
    used: Set[int],
    rng: random.Random,
    total_bandit_pulls: int,
) -> Tuple[int, int]:
    """
    Returns (bank_id, arm_chosen).
    """
    by_arm = build_unused_by_arm(bank, used)
    available_arms = [a for a in range(N_ARMS) if by_arm[a]]
    if not available_arms:
        # Any unused question regardless of stratification
        all_unused = [
            int(q["bank_id"])
            for q in bank
            if int(q.get("bank_id", -1)) >= 0 and int(q.get("bank_id", -1)) not in used
        ]
        if not all_unused:
            return -1, -1
        bid = rng.choice(all_unused)
        qref = next(x for x in bank if int(x.get("bank_id")) == bid)
        arm = arm_index(str(qref.get("difficulty")), str(qref.get("taxonomy")))
        return bid, arm

    qvals = [get_q_tab(q_table, state_id, a) for a in available_arms]
    qn = _normalize_scores(qvals)

    lvals = [q_linear(state_id, a, weights) for a in available_arms]
    ln = _normalize_scores(lvals)

    ucb_all = ucb_values(bandit, total_bandit_pulls)
    uc_sub = [ucb_all[a] for a in available_arms]
    un = _normalize_scores(uc_sub)

    combined = []
    for i, arm in enumerate(available_arms):
        combined.append(W_TABULAR * qn[i] + W_LINEAR * ln[i] + W_UCB * un[i])
    best = max(combined)
    top = [available_arms[i] for i, sc in enumerate(combined) if abs(sc - best) < 1e-9]
    chosen_arm = rng.choice(top)
    bid = rng.choice(by_arm[chosen_arm])
    return bid, chosen_arm


def shaped_reward(is_correct: bool, time_seconds: Optional[float]) -> float:
    r = 1.0 if is_correct else 0.0
    try:
        ts = float(time_seconds) if time_seconds is not None else 60.0
    except (TypeError, ValueError):
        ts = 60.0
    if ts < 5.0:
        r -= 0.08
    elif 25.0 <= ts <= 150.0:
        r += 0.06
    elif ts > 240.0:
        r -= 0.04
    return max(-0.5, min(1.35, r))


def bank_bids(bank: List[Dict[str, Any]]) -> Set[int]:
    return {int(q["bank_id"]) for q in bank if "bank_id" in q}


def empty_policy_buffers() -> Tuple[Dict[str, float], Dict[str, Dict[str, float]], List[float]]:
    return {}, {}, [0.0] * FEATURE_DIM


def merge_loaded_policy(
    q_table: Optional[dict],
    bandit: Optional[dict],
    lin_weights: Optional[list],
) -> Tuple[Dict[str, float], Dict[str, Dict[str, float]], List[float]]:
    qt = dict(q_table or {})
    bd: Dict[str, Dict[str, float]] = {}
    for k, v in (bandit or {}).items():
        if isinstance(v, dict):
            bd[str(k)] = {"n": float(v.get("n", 0)), "sum_r": float(v.get("sum_r", 0.0))}
    lw = list(lin_weights or [])
    if len(lw) != FEATURE_DIM:
        lw = [0.0] * FEATURE_DIM
    return qt, bd, lw


def total_bandit_pulls(bandit: Dict[str, Dict[str, float]]) -> int:
    return int(sum(float((bandit.get(arm_key(a)) or {}).get("n", 0.0)) for a in range(N_ARMS)))
