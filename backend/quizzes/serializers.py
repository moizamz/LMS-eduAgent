from rest_framework import serializers
from .models import Quiz, Question, Choice, QuizAttempt, Answer
from courses.serializers import CourseSerializer
from accounts.serializers import UserSerializer


class ChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        fields = ['id', 'question', 'choice_text', 'is_correct', 'order']
        read_only_fields = ['id']


class QuestionSerializer(serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, read_only=True)
    
    class Meta:
        model = Question
        fields = ['id', 'quiz', 'question_text', 'question_type', 
                  'points', 'order', 'explanation', 'hint', 'difficulty', 'taxonomy', 'choices']
        read_only_fields = ['id']


class QuestionForAttemptSerializer(serializers.ModelSerializer):
    """Used during quiz attempt - includes hint, excludes explanation."""
    choices = ChoiceSerializer(many=True, read_only=True)
    
    class Meta:
        model = Question
        fields = ['id', 'quiz', 'question_text', 'question_type', 
                  'points', 'order', 'hint', 'difficulty', 'taxonomy', 'choices']


class QuestionForReviewSerializer(serializers.ModelSerializer):
    """Used in review after submit - includes explanation."""
    choices = ChoiceSerializer(many=True, read_only=True)
    
    class Meta:
        model = Question
        fields = ['id', 'quiz', 'question_text', 'question_type', 
                  'points', 'order', 'explanation', 'hint', 'difficulty', 'taxonomy', 'choices']


class QuizSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)
    course_id = serializers.IntegerField(write_only=True)
    questions = QuestionSerializer(many=True, read_only=True)
    question_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Quiz
        fields = ['id', 'course', 'course_id', 'title', 'description',
                  'time_limit_minutes', 'passing_score', 'max_attempts',
                  'questions', 'question_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_question_count(self, obj):
        return obj.questions.count()


class AnswerSerializer(serializers.ModelSerializer):
    question = QuestionSerializer(read_only=True)
    selected_choice = ChoiceSerializer(read_only=True)
    
    class Meta:
        model = Answer
        fields = ['id', 'attempt', 'question', 'selected_choice', 
                  'is_correct', 'points_earned']
        read_only_fields = ['id', 'is_correct', 'points_earned']


class QuizAttemptSerializer(serializers.ModelSerializer):
    quiz = QuizSerializer(read_only=True)
    student = UserSerializer(read_only=True)
    answers = AnswerSerializer(many=True, read_only=True)
    
    class Meta:
        model = QuizAttempt
        fields = ['id', 'quiz', 'student', 'started_at', 'submitted_at',
                  'score', 'is_completed', 'attempt_number', 'answers']
        read_only_fields = ['id', 'student', 'started_at', 'submitted_at',
                          'is_completed', 'attempt_number']


class QuizSubmissionSerializer(serializers.Serializer):
    answers = serializers.ListField(
        child=serializers.DictField(
            child=serializers.IntegerField()
        )
    )

