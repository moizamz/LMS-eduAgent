from rest_framework import serializers
from .models import Assignment, AssignmentSubmission
from courses.serializers import CourseSerializer
from accounts.serializers import UserSerializer


class AssignmentSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)
    course_id = serializers.IntegerField(write_only=True, required=False)
    submission_count = serializers.SerializerMethodField()
    instruction_file_url = serializers.SerializerMethodField(read_only=True)
    clear_instruction_file = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')

    class Meta:
        model = Assignment
        fields = [
            'id',
            'course',
            'course_id',
            'title',
            'description',
            'instruction_file',
            'instruction_file_url',
            'clear_instruction_file',
            'due_date',
            'max_score',
            'submission_count',
            'created_at',
            'updated_at',
        ]
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

    def validate(self, attrs):
        if self.instance is None and attrs.get('course_id') is None:
            raise serializers.ValidationError({'course_id': 'This field is required when creating an assignment.'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('clear_instruction_file', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('course_id', None)
        clear_raw = validated_data.pop('clear_instruction_file', '') or ''
        clear = str(clear_raw).strip().lower() in ('true', '1', 'yes', 'on')
        if clear:
            old = instance.instruction_file
            if old:
                old.delete(save=False)
            instance.instruction_file = None
        return super().update(instance, validated_data)


class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    assignment = AssignmentSerializer(read_only=True)
    student = UserSerializer(read_only=True)
    graded_by = serializers.SerializerMethodField(read_only=True)
    submission_file_name = serializers.SerializerMethodField(read_only=True)
    submission_file_size = serializers.SerializerMethodField(read_only=True)
    ai_grading = serializers.SerializerMethodField(read_only=True)
    grading_status = serializers.SerializerMethodField(read_only=True)
    score = serializers.SerializerMethodField(read_only=True)
    feedback = serializers.SerializerMethodField(read_only=True)
    graded_at = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AssignmentSubmission
        fields = [
            'id',
            'assignment',
            'student',
            'submission_file',
            'submission_file_name',
            'submission_file_size',
            'submission_text',
            'submitted_at',
            'score',
            'feedback',
            'graded_by',
            'graded_at',
            'is_graded',
            'ai_grading',
            'grading_status',
        ]
        read_only_fields = ['id', 'student', 'submitted_at', 'graded_by', 'graded_at', 'is_graded', 'grading_status', 'score', 'feedback']

    def _mask_final_grade_for_student(self, obj):
        req = self.context.get('request')
        if not req or not req.user.is_authenticated:
            return False
        if getattr(req.user, 'is_student', False) and not obj.is_graded:
            return True
        return False

    def get_grading_status(self, obj):
        if obj.is_graded:
            return 'graded'
        if obj.submission_file or (obj.submission_text or '').strip():
            return 'submitted_pending'
        return 'not_submitted'

    def get_score(self, obj):
        if self._mask_final_grade_for_student(obj):
            return None
        return obj.score

    def get_feedback(self, obj):
        if self._mask_final_grade_for_student(obj):
            return None
        return obj.feedback

    def get_graded_by(self, obj):
        if self._mask_final_grade_for_student(obj):
            return None
        if not obj.graded_by_id:
            return None
        return UserSerializer(obj.graded_by, context=self.context).data

    def get_graded_at(self, obj):
        if self._mask_final_grade_for_student(obj):
            return None
        return obj.graded_at

    def get_ai_grading(self, obj):
        req = self.context.get('request')
        if not req or not req.user.is_authenticated:
            return None
        if getattr(req.user, 'is_admin', False):
            return obj.ai_grading or {}
        if getattr(req.user, 'is_instructor', False) and obj.assignment.course.instructor_id == req.user.id:
            return obj.ai_grading or {}
        return None

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

