import random
from datetime import timedelta

from django.db.models import Count, Max, Sum
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from courses.models import Course, Enrollment
from gamification.models import EarnedBadge, RewardLedgerEntry, StudentGamificationState
from gamification.student_dashboard_insights import build_student_dashboard_insights
from gamification.personalized_nudge import generate_personalized_remark
from gamification.reward_engine import (
    ARM_LABELS,
    bandit_update,
    build_event_counts,
    compute_points_and_nudge,
    level_from_xp,
    new_badges_for_event,
    proxy_engagement_reward,
    ucb_select_arm,
    update_streak,
    xp_to_next_level,
    _merge_bandit,
)


def _user_can_view_course_leaderboard(user, course: Course) -> bool:
    if getattr(user, 'is_admin', False):
        return True
    if getattr(user, 'is_instructor', False) and course.instructor_id == user.id:
        return True
    return Enrollment.objects.filter(student=user, course=course).exists()


def _user_instructs_course(user, course: Course) -> bool:
    if getattr(user, 'is_admin', False):
        return True
    return getattr(user, 'is_instructor', False) and course.instructor_id == user.id


def _serialize_state(state: StudentGamificationState, earned_slugs: set) -> dict:
    xp = int(state.total_xp)
    into, need = xp_to_next_level(xp)
    return {
        'total_xp': xp,
        'level': level_from_xp(xp),
        'xp_into_level': into,
        'xp_to_next_level': need,
        'current_streak_days': state.current_streak_days,
        'longest_streak_days': state.longest_streak_days,
        'badge_slugs': sorted(earned_slugs),
    }


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def record_engagement_event(request):
    """
    Record a learning event, grant XP (policy + bandit), award badges, persist bandit
    feedback for self-optimization, and return an LLM-personalized remark.
    """
    if not request.user.is_student:
        return Response({'error': 'Only students use engagement rewards'}, status=status.HTTP_403_FORBIDDEN)

    course_id = request.data.get('course_id')
    event_type = (request.data.get('event_type') or 'generic').strip()
    metadata = request.data.get('metadata') or {}

    if not course_id:
        return Response({'error': 'course_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        course = Course.objects.get(id=course_id)
    except Course.DoesNotExist:
        return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

    if not Enrollment.objects.filter(student=request.user, course=course).exists():
        return Response({'error': 'Not enrolled in this course'}, status=status.HTTP_403_FORBIDDEN)

    today = timezone.now().date()

    if event_type == 'daily_login':
        dup = RewardLedgerEntry.objects.filter(
            student=request.user,
            course=course,
            event_type='daily_login',
            created_at__date=today,
        ).exists()
        if dup:
            state, _ = StudentGamificationState.objects.get_or_create(
                student=request.user,
                course=course,
                defaults={'bandit': {}},
            )
            earned = set(
                EarnedBadge.objects.filter(student=request.user, course=course).values_list('slug', flat=True)
            )
            return Response({
                'points_awarded': 0,
                'base_points': 0,
                'bonus_points': 0,
                'level_up': False,
                'badges': [],
                'nudge_key': 'already_checked_in',
                'remark': 'You already checked in today for this course — come back tomorrow for more XP!',
                'state': _serialize_state(state, earned),
                'bandit_arm': ARM_LABELS[0],
            })

    state, _ = StudentGamificationState.objects.get_or_create(
        student=request.user,
        course=course,
        defaults={'bandit': {}},
    )

    new_streak, _ = update_streak(state.last_activity_date, today, state.current_streak_days)
    longest = max(int(state.longest_streak_days), new_streak)
    state.current_streak_days = new_streak
    state.longest_streak_days = longest
    if state.last_activity_date != today:
        state.last_activity_date = today

    bandit = _merge_bandit(state.bandit)
    rng = random.Random()
    arm = ucb_select_arm(bandit, rng)
    base_pts, bonus_pts, nudge_key = compute_points_and_nudge(
        event_type, metadata, state.current_streak_days, arm
    )

    proxy_r = proxy_engagement_reward(event_type, metadata)
    bandit_update(bandit, arm, proxy_r)
    state.bandit = bandit

    counts_before = build_event_counts(request.user.id, course.id)
    practice_count = int(counts_before.get('practice_completed', 0))
    if event_type == 'practice_completed':
        practice_count += 1

    badge_xp = 0
    earned_slugs = set(
        EarnedBadge.objects.filter(student=request.user, course=course).values_list('slug', flat=True)
    )
    xp_before = int(state.total_xp)
    level_before = level_from_xp(xp_before)

    xp_gain = base_pts + bonus_pts
    state.total_xp = xp_before + xp_gain
    xp_after = int(state.total_xp)
    level_after = level_from_xp(xp_after)

    new_badges = new_badges_for_event(
        earned_slugs,
        xp_after,
        state.current_streak_days,
        event_type,
        metadata,
        practice_count,
    )
    for b in new_badges:
        badge_xp += 12
        EarnedBadge.objects.get_or_create(
            student=request.user,
            course=course,
            slug=b['slug'],
            defaults={'title': b['title']},
        )

    if badge_xp:
        state.total_xp = int(state.total_xp) + badge_xp
        xp_after = int(state.total_xp)
        level_after = level_from_xp(xp_after)

    state.save()

    remark = generate_personalized_remark(
        request.user.first_name or request.user.username,
        course.title,
        arm,
        ARM_LABELS[arm],
        event_type,
        xp_gain + badge_xp,
        int(state.total_xp),
        level_after,
        state.current_streak_days,
        new_badges,
        metadata,
    )

    RewardLedgerEntry.objects.create(
        student=request.user,
        course=course,
        event_type=event_type,
        base_points=base_pts,
        bonus_points=bonus_pts + badge_xp,
        bandit_arm=arm,
        proxy_reward=proxy_r,
        llm_remark=remark[:2000],
        nudge_key=nudge_key,
        metadata=metadata,
    )

    earned_slugs = set(
        EarnedBadge.objects.filter(student=request.user, course=course).values_list('slug', flat=True)
    )

    return Response(
        {
            'points_awarded': xp_gain + badge_xp,
            'base_points': base_pts,
            'bonus_points': bonus_pts + badge_xp,
            'level_up': level_after > level_before,
            'level': level_after,
            'badges': new_badges,
            'nudge_key': nudge_key,
            'remark': remark,
            'bandit_arm': ARM_LABELS[arm],
            'state': _serialize_state(state, earned_slugs),
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def course_gamification_summary(request, course_id):
    if not request.user.is_student:
        return Response({'error': 'Only students'}, status=status.HTTP_403_FORBIDDEN)
    try:
        course = Course.objects.get(id=course_id)
    except Course.DoesNotExist:
        return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)
    if not Enrollment.objects.filter(student=request.user, course=course).exists():
        return Response({'error': 'Not enrolled'}, status=status.HTTP_403_FORBIDDEN)

    state = StudentGamificationState.objects.filter(student=request.user, course=course).first()
    badges = list(
        EarnedBadge.objects.filter(student=request.user, course=course).values('slug', 'title', 'earned_at')[:50]
    )
    if not state:
        return Response(
            {
                'state': None,
                'badges': badges,
                'recent_remarks': [],
            }
        )

    earned_slugs = set(
        EarnedBadge.objects.filter(student=request.user, course=course).values_list('slug', flat=True)
    )
    remarks = list(
        RewardLedgerEntry.objects.filter(student=request.user, course=course)
        .exclude(llm_remark='')
        .order_by('-created_at')
        .values('llm_remark', 'created_at', 'event_type', 'base_points', 'bonus_points')[:8]
    )
    return Response(
        {
            'state': _serialize_state(state, earned_slugs),
            'badges': badges,
            'recent_remarks': remarks,
        }
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def course_leaderboard(request, course_id):
    try:
        course = Course.objects.get(id=course_id)
    except Course.DoesNotExist:
        return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

    if not _user_can_view_course_leaderboard(request.user, course):
        return Response({'error': 'Not allowed to view this leaderboard'}, status=status.HTTP_403_FORBIDDEN)

    try:
        limit = min(50, max(5, int(request.query_params.get('limit', 20))))
    except (TypeError, ValueError):
        limit = 20

    rows = []
    rank = 0
    for s in StudentGamificationState.objects.filter(course=course).select_related('student').order_by('-total_xp')[
        :limit
    ]:
        rank += 1
        st = s.student
        badge_count = EarnedBadge.objects.filter(student=st, course=course).count()
        rows.append(
            {
                'rank': rank,
                'username': st.username,
                'display_name': (st.first_name or st.username).strip(),
                'total_xp': int(s.total_xp),
                'level': level_from_xp(int(s.total_xp)),
                'current_streak_days': s.current_streak_days,
                'badge_count': badge_count,
                'is_you': (st.id == request.user.id) if getattr(request.user, 'is_student', False) else False,
            }
        )

    return Response({'course_id': course.id, 'entries': rows})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def instructor_course_students_progress(request, course_id):
    """Per-student progress %, XP, streaks, badges for instructors/admins."""
    try:
        course = Course.objects.get(id=course_id)
    except Course.DoesNotExist:
        return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

    if not _user_instructs_course(request.user, course):
        return Response({'error': 'Only the course instructor or admin'}, status=status.HTTP_403_FORBIDDEN)

    enrollments = Enrollment.objects.filter(course=course).select_related('student')
    states = {s.student_id: s for s in StudentGamificationState.objects.filter(course=course)}
    badge_rows = EarnedBadge.objects.filter(course=course).values('student_id').annotate(n=Count('id'))
    badge_map = {r['student_id']: r['n'] for r in badge_rows}

    students = []
    for e in enrollments:
        st = e.student
        if st.role != 'student':
            continue
        gs = states.get(st.id)
        xp = int(gs.total_xp) if gs else 0
        students.append(
            {
                'student_id': st.id,
                'username': st.username,
                'display_name': (st.first_name or st.username or '').strip(),
                'progress_percentage': round(float(e.progress_percentage or 0), 1),
                'total_xp': xp,
                'level': level_from_xp(xp),
                'current_streak_days': int(gs.current_streak_days) if gs else 0,
                'longest_streak_days': int(gs.longest_streak_days) if gs else 0,
                'badge_count': int(badge_map.get(st.id, 0)),
            }
        )
    students.sort(key=lambda r: r['total_xp'], reverse=True)
    return Response({'course_id': course.id, 'students': students})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def course_gamification_history(request, course_id):
    """Ledger + simple series for charts (per course, enrolled students only)."""
    if not request.user.is_student:
        return Response({'error': 'Only students'}, status=status.HTTP_403_FORBIDDEN)
    try:
        course = Course.objects.get(id=course_id)
    except Course.DoesNotExist:
        return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)
    if not Enrollment.objects.filter(student=request.user, course=course).exists():
        return Response({'error': 'Not enrolled'}, status=status.HTTP_403_FORBIDDEN)

    try:
        limit = min(200, max(20, int(request.query_params.get('limit', 100))))
    except (TypeError, ValueError):
        limit = 100

    state = StudentGamificationState.objects.filter(student=request.user, course=course).first()
    earned_slugs = set(
        EarnedBadge.objects.filter(student=request.user, course=course).values_list('slug', flat=True)
    )

    rows = list(
        RewardLedgerEntry.objects.filter(student=request.user, course=course).order_by('-created_at')[:limit]
    )
    ledger = [
        {
            'id': r.id,
            'event_type': r.event_type,
            'nudge_key': r.nudge_key,
            'base_points': r.base_points,
            'bonus_points': r.bonus_points,
            'points_total': r.base_points + r.bonus_points,
            'bandit_arm_index': r.bandit_arm,
            'remark': (r.llm_remark or '')[:600],
            'created_at': r.created_at.isoformat(),
        }
        for r in rows
    ]

    chrono = list(reversed(rows))
    cum = 0
    xp_curve = []
    for r in chrono:
        cum += r.base_points + r.bonus_points
        xp_curve.append(
            {
                'at': r.created_at.isoformat(),
                'points_delta': r.base_points + r.bonus_points,
                'cumulative_logged_xp': cum,
                'event_type': r.event_type,
            }
        )

    event_counts: dict = {}
    for r in rows:
        event_counts[r.event_type] = event_counts.get(r.event_type, 0) + 1

    badges = list(
        EarnedBadge.objects.filter(student=request.user, course=course).values('slug', 'title', 'earned_at')[:80]
    )

    return Response(
        {
            'course_id': course.id,
            'course_title': course.title,
            'state': _serialize_state(state, earned_slugs) if state else None,
            'ledger': ledger,
            'xp_curve': xp_curve,
            'event_counts': event_counts,
            'badges': badges,
        }
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_gamification_dashboard(request):
    """Cross-course XP snapshot and recent activity for dashboard / My Progress."""
    if not request.user.is_student:
        return Response({'error': 'Only students'}, status=status.HTTP_403_FORBIDDEN)

    from quizzes.models import PracticeSession, QuizAttempt

    states = StudentGamificationState.objects.filter(student=request.user).select_related('course')
    total_xp = sum(int(s.total_xp) for s in states)
    courses = []
    for s in states:
        c = s.course
        badge_n = EarnedBadge.objects.filter(student=request.user, course=c).count()
        courses.append(
            {
                'course_id': c.id,
                'course_title': c.title,
                'total_xp': int(s.total_xp),
                'level': level_from_xp(int(s.total_xp)),
                'current_streak_days': s.current_streak_days,
                'badge_count': badge_n,
            }
        )
    courses.sort(key=lambda x: x['total_xp'], reverse=True)

    recent = []
    for row in RewardLedgerEntry.objects.filter(student=request.user).select_related('course').order_by('-created_at')[
        :12
    ]:
        recent.append(
            {
                'course_title': row.course.title,
                'course_id': row.course_id,
                'event_type': row.event_type,
                'points': row.base_points + row.bonus_points,
                'remark': (row.llm_remark or '')[:320],
                'created_at': row.created_at.isoformat(),
            }
        )

    since = timezone.now() - timedelta(days=14)
    day_totals: dict = {}
    for e in RewardLedgerEntry.objects.filter(student=request.user, created_at__gte=since):
        d = timezone.localtime(e.created_at).date().isoformat()
        day_totals[d] = day_totals.get(d, 0) + e.base_points + e.bonus_points
    xp_by_day = sorted(({'date': k, 'xp': v} for k, v in day_totals.items()), key=lambda x: x['date'])

    badge_total = EarnedBadge.objects.filter(student=request.user).count()

    practice_sec = PracticeSession.objects.filter(student=request.user).aggregate(s=Sum('duration_seconds'))['s'] or 0
    try:
        practice_sec = int(practice_sec)
    except (TypeError, ValueError):
        practice_sec = 0

    quiz_sec = 0
    for a in QuizAttempt.objects.filter(student=request.user, is_completed=True).exclude(submitted_at=None):
        try:
            quiz_sec += max(0, int((a.submitted_at - a.started_at).total_seconds()))
        except Exception:
            pass

    total_practice_quiz_hours = round((practice_sec + quiz_sec) / 3600.0, 2)

    streak_agg = StudentGamificationState.objects.filter(student=request.user).aggregate(
        longest=Max('longest_streak_days'),
        current_best=Max('current_streak_days'),
    )
    longest_streak_days = int(streak_agg['longest'] or 0)
    current_streak_best_course = int(streak_agg['current_best'] or 0)

    today = timezone.localdate()
    activity_dates = set()
    window_start = timezone.now() - timedelta(days=14)
    for e in RewardLedgerEntry.objects.filter(student=request.user, created_at__gte=window_start):
        activity_dates.add(timezone.localtime(e.created_at).date())
    for p in PracticeSession.objects.filter(student=request.user, created_at__gte=window_start):
        activity_dates.add(timezone.localtime(p.created_at).date())
        if p.completed_at:
            activity_dates.add(timezone.localtime(p.completed_at).date())
    for a in QuizAttempt.objects.filter(student=request.user, started_at__gte=window_start):
        activity_dates.add(timezone.localtime(a.started_at).date())
        if a.submitted_at:
            activity_dates.add(timezone.localtime(a.submitted_at).date())

    week_activity = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        week_activity.append({'date': d.isoformat(), 'active': d in activity_dates})

    weekly_active_streak_days = 0
    d = today
    while d in activity_dates:
        weekly_active_streak_days += 1
        d -= timedelta(days=1)

    insights = build_student_dashboard_insights(request.user)

    return Response(
        {
            'total_xp_across_courses': total_xp,
            'badge_total': badge_total,
            'courses': courses,
            'recent_activity': recent,
            'xp_by_day': xp_by_day,
            'total_practice_quiz_hours': total_practice_quiz_hours,
            'longest_streak_days': longest_streak_days,
            'current_streak_best_course': current_streak_best_course,
            'weekly_active_streak_days': weekly_active_streak_days,
            'week_activity': week_activity,
            'insights': insights,
        }
    )
