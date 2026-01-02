from rest_framework import serializers
from .models import Discussion, Comment
from courses.serializers import CourseSerializer
from accounts.serializers import UserSerializer


class CommentSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    replies = serializers.SerializerMethodField()
    reply_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = ['id', 'discussion', 'parent_comment', 'content', 'created_by',
                  'created_at', 'updated_at', 'is_edited', 'replies', 'reply_count']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at', 'is_edited']
    
    def get_replies(self, obj):
        replies = Comment.objects.filter(parent_comment=obj)
        return CommentSerializer(replies, many=True).data
    
    def get_reply_count(self, obj):
        return Comment.objects.filter(parent_comment=obj).count()


class DiscussionSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)
    course_id = serializers.IntegerField(write_only=True)
    created_by = UserSerializer(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    comment_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Discussion
        fields = ['id', 'course', 'course_id', 'title', 'content', 'created_by',
                  'created_at', 'updated_at', 'is_pinned', 'is_locked', 
                  'comments', 'comment_count']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
    
    def get_comment_count(self, obj):
        return obj.comments.count()

