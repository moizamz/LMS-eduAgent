from django.contrib import admin
from .models import EarnedBadge, RewardLedgerEntry, StudentGamificationState


@admin.register(StudentGamificationState)
class StudentGamificationStateAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'total_xp', 'current_streak_days', 'updated_at')
    list_filter = ('course',)


@admin.register(EarnedBadge)
class EarnedBadgeAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'slug', 'earned_at')


@admin.register(RewardLedgerEntry)
class RewardLedgerEntryAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'event_type', 'base_points', 'bonus_points', 'bandit_arm', 'created_at')
    list_filter = ('event_type', 'course')
