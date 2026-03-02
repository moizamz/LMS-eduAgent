from rest_framework import serializers
from .models import (
    Quiz, Question, Choice, QuizAttempt, Answer,
    ChatSession, ChatMessage, PracticeSession,
)
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


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'role', 'content', 'created_at']
        read_only_fields = fields


class ChatSessionSerializer(serializers.ModelSerializer):
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = ['id', 'title', 'course', 'created_at', 'updated_at', 'last_message']
        read_only_fields = fields

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        if not msg:
            return None
        return {
            'role': msg.role,
            'content': msg.content[:120],
            'created_at': msg.created_at,
        }


class ChatSessionDetailSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta:
        model = ChatSession
        fields = ['id', 'title', 'course', 'created_at', 'updated_at', 'messages']
        read_only_fields = fields


class PracticeSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PracticeSession
        fields = [
            'id', 'course', 'created_at', 'completed_at',
            'num_questions', 'num_correct', 'duration_seconds',
        ]
        read_only_fields = fields


class PracticeSessionDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = PracticeSession
        fields = [
            'id', 'course', 'created_at', 'completed_at',
            'num_questions', 'num_correct', 'duration_seconds',
            'data',
        ]
        read_only_fields = fields

