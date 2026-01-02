from rest_framework import serializers
from .models import Assignment, AssignmentSubmission
from courses.serializers import CourseSerializer
from accounts.serializers import UserSerializer


class AssignmentSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)
    course_id = serializers.IntegerField(write_only=True)
    submission_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Assignment
        fields = ['id', 'course', 'course_id', 'title', 'description', 
                  'due_date', 'max_score', 'submission_count', 
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_submission_count(self, obj):
        return obj.submissions.count()


class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    assignment = AssignmentSerializer(read_only=True)
    student = UserSerializer(read_only=True)
    graded_by = UserSerializer(read_only=True)
    
    class Meta:
        model = AssignmentSubmission
        fields = ['id', 'assignment', 'student', 'submission_file', 
                  'submission_text', 'submitted_at', 'score', 'feedback',
                  'graded_by', 'graded_at', 'is_graded']
        read_only_fields = ['id', 'student', 'submitted_at', 'graded_by', 
                          'graded_at', 'is_graded']

