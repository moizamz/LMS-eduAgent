from rest_framework import serializers
from .models import Assignment, AssignmentSubmission
from courses.serializers import CourseSerializer
from accounts.serializers import UserSerializer


class AssignmentSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)
    course_id = serializers.IntegerField(write_only=True)
    submission_count = serializers.SerializerMethodField()
    instruction_file_url = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = Assignment
        fields = ['id', 'course', 'course_id', 'title', 'description',
                  'instruction_file', 'instruction_file_url',
                  'due_date', 'max_score', 'submission_count', 
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_submission_count(self, obj):
        return obj.submissions.count()

    def get_instruction_file_url(self, obj):
        if not obj.instruction_file:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.instruction_file.url)
        return obj.instruction_file.url


class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    assignment = AssignmentSerializer(read_only=True)
    student = UserSerializer(read_only=True)
    graded_by = UserSerializer(read_only=True)
    submission_file_name = serializers.SerializerMethodField(read_only=True)
    submission_file_size = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = AssignmentSubmission
        fields = ['id', 'assignment', 'student', 'submission_file', 
                  'submission_file_name', 'submission_file_size',
                  'submission_text', 'submitted_at', 'score', 'feedback',
                  'graded_by', 'graded_at', 'is_graded']
        read_only_fields = ['id', 'student', 'submitted_at', 'graded_by', 
                          'graded_at', 'is_graded']

    def get_submission_file_name(self, obj):
        try:
            return obj.submission_file.name.split('/')[-1] if obj.submission_file else None
        except Exception:
            return None

    def get_submission_file_size(self, obj):
        try:
            return obj.submission_file.size if obj.submission_file else None
        except Exception:
            return None

