from rest_framework import serializers
from .models import Course, Module, Enrollment, ModuleProgress
from accounts.serializers import UserSerializer


class ModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Module
        fields = ['id', 'course', 'title', 'description', 'order', 'content_type',
                  'video_url', 'pdf_file', 'external_link', 'text_content', 
                  'duration_minutes', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class CourseSerializer(serializers.ModelSerializer):
    instructor = UserSerializer(read_only=True)
    instructor_id = serializers.IntegerField(write_only=True, required=False)
    modules = ModuleSerializer(many=True, read_only=True)
    enrollment_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Course
        fields = ['id', 'title', 'description', 'instructor', 'instructor_id',
                  'thumbnail', 'price', 'is_published', 'modules', 'enrollment_count',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_enrollment_count(self, obj):
        return obj.enrollments.count()
    
    def create(self, validated_data):
        instructor_id = validated_data.pop('instructor_id', None)
        if instructor_id:
            from accounts.models import User
            validated_data['instructor'] = User.objects.get(id=instructor_id)
        else:
            validated_data['instructor'] = self.context['request'].user
        return super().create(validated_data)


class EnrollmentSerializer(serializers.ModelSerializer):
    student = UserSerializer(read_only=True)
    course = CourseSerializer(read_only=True)
    course_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = Enrollment
        fields = ['id', 'student', 'course', 'course_id', 'enrolled_at',
                  'progress_percentage', 'is_completed', 'completed_at']
        read_only_fields = ['id', 'student', 'enrolled_at', 'completed_at']
    
    def create(self, validated_data):
        validated_data['student'] = self.context['request'].user
        return super().create(validated_data)


class ModuleProgressSerializer(serializers.ModelSerializer):
    module = ModuleSerializer(read_only=True)
    
    class Meta:
        model = ModuleProgress
        fields = ['id', 'enrollment', 'module', 'is_completed', 
                  'completed_at', 'last_accessed']
        read_only_fields = ['id', 'completed_at', 'last_accessed']

