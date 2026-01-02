from django.contrib import admin
from .models import Assignment, AssignmentSubmission


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ['title', 'course', 'due_date', 'max_score', 'created_at']
    list_filter = ['due_date', 'created_at']
    search_fields = ['title', 'description']


@admin.register(AssignmentSubmission)
class AssignmentSubmissionAdmin(admin.ModelAdmin):
    list_display = ['student', 'assignment', 'score', 'is_graded', 'submitted_at']
    list_filter = ['is_graded', 'submitted_at']
    search_fields = ['student__username', 'assignment__title']

