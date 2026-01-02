from rest_framework import serializers
from .models import Announcement, Notification
from courses.serializers import CourseSerializer
from accounts.serializers import UserSerializer


class AnnouncementSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)
    course_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    created_by = UserSerializer(read_only=True)
    
    class Meta:
        model = Announcement
        fields = ['id', 'course', 'course_id', 'title', 'content', 
                  'priority', 'created_by', 'created_at', 'updated_at', 'is_active']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']


class NotificationSerializer(serializers.ModelSerializer):
    announcement = AnnouncementSerializer(read_only=True)
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Notification
        fields = ['id', 'user', 'announcement', 'message', 
                  'is_read', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']

