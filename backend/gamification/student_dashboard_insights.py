"""
Rule-based, data-driven insight lines for the student dashboard (no LLM).
"""
from __future__ import annotations

from collections import Counter

from django.db.models import Max

from assignments.models import AssignmentSubmission
from courses.models import Enrollment
from gamification.models import StudentGamificationState
from quizzes.adaptive_theta import format_topic_hist_label, merge_ability_state
from quizzes.models import PracticeSession, QuizAttempt, StudentAdaptivePolicyState


def _append(out: list, insight_id: str, title: str, body: str, variant: str) -> None:
    if not body or not title:
        return
    out.append({'id': insight_id, 'title': title, 'body': body, 'variant': variant})


def _adaptive_session_rates(user) -> list[float]:
    """Recent adaptive practice sessions → list of session accuracies (0–1), newest first."""
    rates: list[float] = []
    for sess in PracticeSession.objects.filter(student=user).order_by('-created_at')[:15]:
        d = sess.data or {}
        if d.get('mode') != 'adaptive':
            continue
        log = (d.get('adaptive') or {}).get('log') or []
        if len(log) < 2:
            continue
        ok = sum(1 for e in log if e.get('is_correct'))
        rates.append(ok / len(log))
    return rates


def _append_per_course_quiz_spread(out: list, attempts: list, enrollments: list) -> None:
    """When the student has attempts in 2+ courses, highlight strongest vs weakest course averages."""
    if len(attempts) < 4:
        return
    by_course: dict[int, list[float]] = {}
    titles: dict[int, str] = {}
    for e in enrollments:
        titles[e.course_id] = (e.course.title or '')[:80]
    for a in attempts:
        if not a.quiz or not a.quiz.course_id:
            continue
        cid = a.quiz.course_id
        try:
            by_course.setdefault(cid, []).append(float(a.score))
        except (TypeError, ValueError):
            continue
    if len(by_course) < 2:
        return
    avs = [(cid, sum(xs) / len(xs)) for cid, xs in by_course.items() if xs]
    if len(avs) < 2:
        return
    avs.sort(key=lambda x: -x[1])
    best_cid, best_a = avs[0]
    worst_cid, worst_a = avs[-1]
    if best_cid == worst_cid or best_a - worst_a < 8:
        return
    bt = titles.get(best_cid, 'One course')
    wt = titles.get(worst_cid, 'Another course')
    _append(
        out,
        'course_quiz_spread',
        'Performance by course',
        f'Quiz averages differ by course: strongest recently in “{bt}” (~{best_a:.0f}%) vs more headroom in “{wt}” (~{worst_a:.0f}%). Balance time where you gain the most.',
        'neutral',
    )


def _append_last_vs_average(out: list, scores: list) -> None:
    if len(scores) < 2:
        return
    last = scores[-1]
    prev_avg = sum(scores[:-1]) / max(1, len(scores) - 1)
    gap = last - prev_avg
    if gap >= 8:
        _append(
            out,
            'last_vs_avg_up',
            'Latest quiz',
            f'Your most recent score ({last:.0f}%) is above your prior average ({prev_avg:.0f}%) — momentum is up.',
            'positive',
        )
    elif gap <= -8:
        _append(
            out,
            'last_vs_avg_down',
            'Latest quiz',
            f'Your most recent score ({last:.0f}%) dipped below your prior average ({prev_avg:.0f}%). Revisit that quiz’s weak objectives before the next attempt.',
            'attention',
        )


def _append_adaptive_practice_insights(out: list, user) -> None:
    rates = _adaptive_session_rates(user)
    if not rates:
        return
    if len(rates) >= 3:
        recent = sum(rates[:3]) / 3.0
        tail = rates[3:6]
        if tail:
            older = sum(tail) / len(tail)
            if recent >= older + 0.12:
                _append(
                    out,
                    'adaptive_momentum',
                    'Adaptive practice',
                    'Your last few adaptive sessions are more accurate than the ones before — skills are consolidating.',
                    'positive',
                )
                return
            if recent <= older - 0.12:
                _append(
                    out,
                    'adaptive_slip',
                    'Adaptive practice',
                    'Recent adaptive rounds are a bit below your earlier accuracy — slow down and review explanations before continuing.',
                    'attention',
                )
                return
    avg = sum(rates) / len(rates)
    pct = 100.0 * avg
    var = 'positive' if avg >= 0.68 else 'attention' if avg < 0.52 else 'neutral'
    body = (
        f'Across your recent adaptive practice sessions you average about {pct:.0f}% items correct '
        + ('— strong adaptive work.' if avg >= 0.68 else '— room to grow; short daily sets help.')
    )
    _append(out, 'adaptive_sessions_summary', 'Adaptive practice', body, var)


def build_student_dashboard_insights(user) -> list[dict]:
    """Return a short list of insights for ``user`` (student), each driven by live performance data."""
    out: list[dict] = []

    enrollments = list(Enrollment.objects.filter(student=user).select_related('course'))
    if not enrollments:
        _append(
            out,
            'start',
            'Get started',
            'Enroll in a course to unlock insights based on your quiz scores, assignments, streaks, and adaptive practice.',
            'neutral',
        )
        return out

    n_courses = len(enrollments)
    progresses = [float(e.progress_percentage or 0) for e in enrollments]
    mean_prog = sum(progresses) / len(progresses) if progresses else 0.0
    low_prog = [e.course.title for e, p in zip(enrollments, progresses) if p < 18][:3]

    _append(
        out,
        'enrollment',
        'Course activity',
        f'You are enrolled in {n_courses} course{"s" if n_courses != 1 else ""} with an average progress of {mean_prog:.0f}%. '
        + ('Keep opening modules to move each course forward.' if mean_prog < 45 else 'Solid momentum across your enrollments.'),
        'positive' if mean_prog >= 45 else 'neutral',
    )

    if low_prog:
        names = ', '.join(low_prog)
        _append(
            out,
            'progress_lag',
            'Pick up where you left off',
            f'Progress is still early in: {names}. A short session today can move the needle.',
            'attention',
        )

    attempts = list(
        QuizAttempt.objects.filter(student=user, is_completed=True)
        .exclude(score__isnull=True)
        .select_related('quiz', 'quiz__course')
        .order_by('submitted_at')
    )
    scores = [float(a.score) for a in attempts if a.score is not None]

    if scores:
        avg = sum(scores) / len(scores)
        hi, lo = max(scores), min(scores)
        half = len(scores) // 2
        if len(scores) >= 6 and half >= 1:
            early = scores[:half]
            late = scores[half:]
            e_avg = sum(early) / len(early)
            l_avg = sum(late) / len(late)
            if l_avg >= e_avg + 5:
                trend_msg = 'Your more recent quiz scores are higher than earlier ones — nice improvement.'
                trend_var = 'positive'
            elif e_avg >= l_avg + 5:
                trend_msg = 'Earlier quizzes were stronger than recent ones — schedule a short review session.'
                trend_var = 'attention'
            else:
                trend_msg = 'Quiz scores have been fairly steady — push specific weak topics to lift the average.'
                trend_var = 'neutral'
        else:
            trend_msg = 'Complete a few more graded quizzes so we can spot trends in your performance.'
            trend_var = 'neutral'

        if avg >= 82:
            perf = 'Strong overall quiz performance — keep mixing practice with new material.'
            var = 'positive'
        elif avg >= 65:
            perf = f'Quiz average is {avg:.0f}% — you are on track; tighten gaps on topics you miss most often.'
            var = 'neutral'
        else:
            perf = f'Quiz average is {avg:.0f}% — revisit course materials and try adaptive practice on weaker areas.'
            var = 'attention'

        _append(out, 'quiz_summary', 'Quizzes', perf, var)
        _append(out, 'quiz_trend', 'Quiz trajectory', trend_msg, trend_var)
        _append(
            out,
            'quiz_range',
            'Score range',
            f'Across completed quizzes: high {hi:.0f}%, low {lo:.0f}% — use the gap to guide what to review next.',
            'neutral',
        )
        _append_last_vs_average(out, scores)
        _append_per_course_quiz_spread(out, attempts, enrollments)
    else:
        _append(
            out,
            'quiz_empty',
            'Quizzes',
            'No completed graded quizzes yet — finish a quiz in any enrolled course to see score-based insights.',
            'neutral',
        )

    weak_counter: Counter[str] = Counter()
    strong_counter: Counter[str] = Counter()
    rec_counter: Counter[str] = Counter()

    for en in enrollments:
        course = en.course
        pol = StudentAdaptivePolicyState.objects.filter(student=user, course=course).first()
        astate = merge_ability_state(getattr(pol, 'ability_state', None) if pol else None)
        topic_hist = astate.get('topic_hist') or {}
        for topic_key, cell in topic_hist.items():
            if not isinstance(cell, dict):
                continue
            n = int(cell.get('n', 0))
            c = int(cell.get('c', 0))
            if n < 2:
                continue
            p = c / max(1, n)
            label = format_topic_hist_label(str(topic_key))
            if p >= 0.72:
                strong_counter[label] += 1
            elif p < 0.58:
                weak_counter[label] += 1

        theta = float(astate.get('theta', 0.0))
        if theta < -0.25:
            rec_counter['Easy → Moderate'] += 1
        elif theta > 0.55:
            rec_counter['Moderate → Hard'] += 1
        else:
            rec_counter['Moderate'] += 1

    if weak_counter:
        top_weak = [t for t, _ in weak_counter.most_common(4)]
        _append(
            out,
            'weak_topics',
            'Topics to reinforce',
            'Practice more on: ' + ', '.join(top_weak) + ' — adaptive data shows these need more correct reps.',
            'attention',
        )
    if strong_counter:
        top_strong = [t for t, _ in strong_counter.most_common(3)]
        _append(
            out,
            'strong_topics',
            'Strengths',
            'You are consistently strong in: ' + ', '.join(top_strong) + '.',
            'positive',
        )

    if rec_counter:
        top_rec, n = rec_counter.most_common(1)[0]
        _append(
            out,
            'adaptive_level',
            'Adaptive difficulty',
            f'Most of your enrolled courses suggest {top_rec} practice ({n} of {n_courses} course signals) — the tutor is calibrating to your ability curve.',
            'neutral',
        )

    _append_adaptive_practice_insights(out, user)

    graded = list(
        AssignmentSubmission.objects.filter(student=user, is_graded=True)
        .exclude(score__isnull=True)
        .select_related('assignment')
    )
    if graded:
        pcts = []
        for s in graded:
            mx = s.assignment.max_score or 100
            if mx <= 0:
                continue
            pcts.append(100.0 * float(s.score) / float(mx))
        if pcts:
            a_pct = sum(pcts) / len(pcts)
            if a_pct >= 80:
                msg = f'Graded assignments average about {a_pct:.0f}% — excellent work on written work.'
                v = 'positive'
            elif a_pct >= 65:
                msg = f'Graded assignments average about {a_pct:.0f}% — steady; read instructor feedback closely on lower items.'
                v = 'neutral'
            else:
                msg = f'Graded assignments average about {a_pct:.0f}% — focus on rubric expectations and resubmit where allowed.'
                v = 'attention'
            _append(out, 'assignments', 'Assignments', msg, v)
    else:
        _append(
            out,
            'assignments_empty',
            'Assignments',
            'No graded assignment submissions yet — submit work when instructors post tasks to track this signal.',
            'neutral',
        )

    streak_agg = StudentGamificationState.objects.filter(student=user).aggregate(
        best_current=Max('current_streak_days'),
        best_long=Max('longest_streak_days'),
    )
    best_cur = int(streak_agg['best_current'] or 0)
    best_long = int(streak_agg['best_long'] or 0)
    if best_cur >= 5 or best_long >= 7:
        _append(
            out,
            'streak',
            'Consistency',
            f'Your best active streak is {best_cur} day(s) right now (longest ever {best_long}d). Regular short sessions beat cramming.',
            'positive',
        )
    elif best_cur == 0 and best_long == 0:
        _append(
            out,
            'streak_start',
            'Consistency',
            'Complete any quiz, practice session, or graded activity today to start a visible streak on your dashboard.',
            'neutral',
        )
    else:
        _append(
            out,
            'streak_mid',
            'Consistency',
            f'Current best streak across courses: {best_cur}d (record {best_long}d). One activity tomorrow extends it.',
            'neutral',
        )

    return out[:12]
