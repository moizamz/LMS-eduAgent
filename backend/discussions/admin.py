from django.contrib import admin
from .models import Discussion, Comment


@admin.register(Discussion)
class DiscussionAdmin(admin.ModelAdmin):
    list_display = ['title', 'course', 'created_by', 'is_pinned', 'is_locked', 'created_at']
    list_filter = ['is_pinned', 'is_locked', 'created_at']
    search_fields = ['title', 'content']


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['discussion', 'created_by', 'is_edited', 'created_at']
    list_filter = ['is_edited', 'created_at']
    search_fields = ['content']

