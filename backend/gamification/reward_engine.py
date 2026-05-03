"""
Engagement rewards: base XP by event, streak multipliers, badge rules,
and a UCB1 multi-armed bandit over reward 'personalities' that modulate
bonus XP and LLM tone (self-optimizing toward proxy engagement signals).
"""

from __future__ import annotations

import math
import random
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

N_ARMS = 4
ARM_LABELS = ('balanced', 'xp_heavy', 'streak_focus', 'challenge')

# Base XP by event type (extend as frontend emits more events)
BASE_XP = {
    'daily_login': 5,
    'lesson_completed': 15,
    'quiz_submitted': 20,
    'practice_completed': 18,
    'assignment_submitted': 25,
    'course_opened': 2,
    'generic': 5,
}

# Per-arm: (bonus_multiplier on computed bonus pool, nudge_weight 0–1)
ARM_STYLE: Tuple[Tuple[float, float], ...] = (
    (1.0, 0.5),
    (1.45, 0.25),
    (1.1, 0.85),
    (1.2, 0.7),
)

LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1500, 2500, 4000, 6000, 10000]


def level_from_xp(xp: int) -> int:
    xp = max(0, int(xp))
    lvl = 1
    for i, t in enumerate(LEVEL_THRESHOLDS):
        if xp >= t:
            lvl = i + 1
    return min(lvl, len(LEVEL_THRESHOLDS))


def xp_to_next_level(xp: int) -> Tuple[int, int]:
    """Returns (xp_into_current_level, xp_needed_for_next)."""
    xp = max(0, int(xp))
    lvl = level_from_xp(xp)
    if lvl >= len(LEVEL_THRESHOLDS):
        floor_xp = LEVEL_THRESHOLDS[-1]
        return xp - floor_xp, 0
    floor_xp = LEVEL_THRESHOLDS[lvl - 1]
    ceil_xp = LEVEL_THRESHOLDS[lvl]
    return xp - floor_xp, max(0, ceil_xp - xp)


def new_badges_for_event(
    earned_slugs: set,
    total_xp_after: int,
    streak_days: int,
    event_type: str,
    metadata: Dict[str, Any],
    practice_count: int,
) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    meta = metadata or {}

    def add(slug: str, title: str):
        if slug not in earned_slugs:
            out.append({'slug': slug, 'title': title})

    if total_xp_after > 0:
        add('first_steps', 'First steps')
    if streak_days >= 3:
        add('on_fire', 'On a roll')
    if streak_days >= 7:
        add('week_warrior', 'Week warrior')
    if event_type == 'quiz_submitted' and float(meta.get('score', 0) or 0) >= 90:
        add('quiz_ace', 'Quiz ace')
    if practice_count >= 5:
        add('practice_regular', 'Practice regular')
    if total_xp_after >= 500:
        add('xp_hunter', 'XP hunter')
    if total_xp_after >= 2000:
        add('legend', 'Course legend')
    return out


def _merge_bandit(raw: Optional[dict]) -> Dict[str, Dict[str, float]]:
    out: Dict[str, Dict[str, float]] = {}
    for a in range(N_ARMS):
        k = str(a)
        cell = (raw or {}).get(k) or {}
        out[k] = {'n': float(cell.get('n', 0.0)), 'sum_r': float(cell.get('sum_r', 0.0))}
    return out


def _bandit_total_pulls(bandit: Dict[str, Dict[str, float]]) -> int:
    return int(sum(int(bandit[str(a)]['n']) for a in range(N_ARMS)))


def ucb_select_arm(bandit: Dict[str, Dict[str, float]], rng: random.Random) -> int:
    t = max(1, _bandit_total_pulls(bandit))
    log_t = math.log(t + 1.0)
    best_arm = 0
    best_score = -1e18
    for a in range(N_ARMS):
        cell = bandit[str(a)]
        n = float(cell['n'])
        if n <= 0:
            score = 1e9 + rng.random()
        else:
            mean = float(cell['sum_r']) / n
            score = mean + 1.0 * math.sqrt(log_t / n)
        if score > best_score:
            best_score = score
            best_arm = a
    return best_arm


def bandit_update(bandit: Dict[str, Dict[str, float]], arm: int, reward: float) -> None:
    arm = max(0, min(N_ARMS - 1, int(arm)))
    k = str(arm)
    c = bandit[k]
    c['n'] = float(c['n']) + 1.0
    c['sum_r'] = float(c['sum_r']) + float(reward)
    bandit[k] = c


def proxy_engagement_reward(event_type: str, metadata: Dict[str, Any]) -> float:
    """Scalar feedback signal in [0, 1] for bandit learning (surrogate for 'did this help engagement')."""
    meta = metadata or {}
    et = event_type or 'generic'
    if et == 'quiz_submitted':
        sc = float(meta.get('score', 0) or 0)
        return min(1.0, max(0.15, sc / 100.0))
    if et == 'practice_completed':
        tot = int(meta.get('total_questions', 1) or 1)
        ok = int(meta.get('num_correct', 0) or 0)
        return min(1.0, max(0.2, ok / max(1, tot)))
    if et == 'assignment_submitted':
        return 0.75
    if et in ('lesson_completed', 'daily_login'):
        return 0.55
    if et == 'course_opened':
        return 0.25
    return 0.35


def update_streak(last_activity: Optional[date], today: date, current: int) -> Tuple[int, int]:
    """Returns (new_current_streak, delta_days_for_longest)."""
    if last_activity is None:
        return 1, 0
    if last_activity == today:
        return max(1, current), 0
    if last_activity == today - timedelta(days=1):
        return current + 1, 0
    return 1, 0


def base_points_for_event(event_type: str) -> int:
    return int(BASE_XP.get(event_type, BASE_XP['generic']))


def compute_points_and_nudge(
    event_type: str,
    metadata: Dict[str, Any],
    streak_days: int,
    arm: int,
) -> Tuple[int, int, str]:
    """Returns (base_pts, bonus_pts, nudge_key)."""
    base = base_points_for_event(event_type)
    pool = max(3, int(round(base * 0.35)))
    streak_bonus = min(15, int(streak_days) * 2)
    mult, weight = ARM_STYLE[max(0, min(N_ARMS - 1, arm))]
    bonus = int(round((pool + streak_bonus) * mult * (0.85 + 0.15 * weight)))
    keys = ('keep_going', 'streak_celebrate', 'level_push', 'leaderboard_nudge')
    nk = keys[arm % len(keys)]
    return base, bonus, nk


def build_event_counts(student_id: int, course_id: int, window_days: int = 120) -> Dict[str, int]:
    from gamification.models import RewardLedgerEntry
    from django.utils import timezone

    since = timezone.now() - timedelta(days=window_days)
    qs = RewardLedgerEntry.objects.filter(
        student_id=student_id,
        course_id=course_id,
        created_at__gte=since,
    ).values_list('event_type', flat=True)
    counts: Dict[str, int] = {}
    for et in qs:
        counts[et] = counts.get(et, 0) + 1
    return counts
