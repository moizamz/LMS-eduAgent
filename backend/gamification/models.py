from django.conf import settings
from django.db import models
from courses.models import Course


class StudentGamificationState(models.Model):
    """Per-student, per-course XP, streaks, and bandit statistics for reward personalization."""
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='gamification_states',
        limit_choices_to={'role': 'student'},
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='gamification_states',
    )
    total_xp = models.PositiveIntegerField(default=0)
    current_streak_days = models.PositiveIntegerField(default=0)
    longest_streak_days = models.PositiveIntegerField(default=0)
    last_activity_date = models.DateField(blank=True, null=True)
    bandit = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['student', 'course']
        ordering = ['-total_xp']

    def __str__(self):
        return f"{self.student.username} @ {self.course_id}: {self.total_xp} XP"


class EarnedBadge(models.Model):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='earned_badges',
        limit_choices_to={'role': 'student'},
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='earned_badges',
    )
    slug = models.CharField(max_length=64, db_index=True)
    title = models.CharField(max_length=120)
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['student', 'course', 'slug']
        ordering = ['-earned_at']

    def __str__(self):
        return f"{self.slug} — {self.student.username}"


class RewardLedgerEntry(models.Model):
    """Audit trail for points, chosen policy arm, and optional LLM copy."""
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reward_ledger',
        limit_choices_to={'role': 'student'},
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='reward_ledger',
    )
    event_type = models.CharField(max_length=64)
    base_points = models.PositiveIntegerField(default=0)
    bonus_points = models.PositiveIntegerField(default=0)
    bandit_arm = models.PositiveSmallIntegerField(default=0)
    proxy_reward = models.FloatField(default=0.0)
    llm_remark = models.TextField(blank=True)
    nudge_key = models.CharField(max_length=64, blank=True)
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.event_type} +{self.base_points + self.bonus_points} XP"
