from rest_framework import generics, status, permissions, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count, Avg
from .models import Quiz, Question, Choice, QuizAttempt, Answer
from .serializers import (QuizSerializer, QuestionSerializer, ChoiceSerializer,
                         QuizAttemptSerializer, QuizSubmissionSerializer)
from courses.models import Course, Enrollment


class QuizListView(generics.ListCreateAPIView):
    serializer_class = QuizSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        course_id = self.request.query_params.get('course_id')
        if not course_id:
            return Quiz.objects.none()
        
        course = Course.objects.get(id=course_id)
        
        # Check permissions
        if self.request.user.is_student:
            if not Enrollment.objects.filter(student=self.request.user, course=course).exists():
                return Quiz.objects.none()
        elif self.request.user.is_instructor:
            if course.instructor != self.request.user:
                return Quiz.objects.none()
        
        return Quiz.objects.filter(course_id=course_id)
    
    def perform_create(self, serializer):
        course_id = self.request.data.get('course_id')
        if not course_id:
            raise serializers.ValidationError("course_id is required")
        
        course = Course.objects.get(id=course_id)
        if not (self.request.user.is_admin or course.instructor == self.request.user):
            raise permissions.PermissionDenied("Only course instructor can create quizzes")
        
        serializer.save()


class QuizDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = QuizSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        if self.request.user.is_admin:
            return Quiz.objects.all()
        elif self.request.user.is_instructor:
            return Quiz.objects.filter(course__instructor=self.request.user)
        else:
            enrolled_courses = Enrollment.objects.filter(
                student=self.request.user
            ).values_list('course_id', flat=True)
            return Quiz.objects.filter(course_id__in=enrolled_courses)


class QuestionListView(generics.ListCreateAPIView):
    serializer_class = QuestionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        quiz_id = self.request.query_params.get('quiz_id')
        if not quiz_id:
            return Question.objects.none()
        
        quiz = Quiz.objects.get(id=quiz_id)
        
        # Check permissions
        if self.request.user.is_student:
            return Question.objects.none()  # Students see questions only during attempt
        elif self.request.user.is_instructor:
            if quiz.course.instructor != self.request.user:
                return Question.objects.none()
        
        return Question.objects.filter(quiz_id=quiz_id)
    
    def perform_create(self, serializer):
        quiz_id = self.request.data.get('quiz')
        if not quiz_id:
            raise serializers.ValidationError("quiz is required")
        
        quiz = Quiz.objects.get(id=quiz_id)
        if not (self.request.user.is_admin or quiz.course.instructor == self.request.user):
            raise permissions.PermissionDenied("Only course instructor can add questions")
        
        serializer.save()


class ChoiceListView(generics.ListCreateAPIView):
    serializer_class = ChoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        question_id = self.request.query_params.get('question_id')
        if not question_id:
            return Choice.objects.none()
        
        question = Question.objects.get(id=question_id)
        
        if self.request.user.is_student:
            return Choice.objects.none()
        elif self.request.user.is_instructor:
            if question.quiz.course.instructor != self.request.user:
                return Choice.objects.none()
        
        return Choice.objects.filter(question_id=question_id)
    
    def perform_create(self, serializer):
        question_id = self.request.data.get('question')
        if not question_id:
            raise serializers.ValidationError("question is required")
        
        question = Question.objects.get(id=question_id)
        if not (self.request.user.is_admin or question.quiz.course.instructor == self.request.user):
            raise permissions.PermissionDenied("Only course instructor can add choices")
        
        serializer.save()


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def start_quiz(request, quiz_id):
    if not request.user.is_student:
        return Response({'error': 'Only students can take quizzes'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        quiz = Quiz.objects.get(id=quiz_id)
        if not Enrollment.objects.filter(student=request.user, course=quiz.course).exists():
            return Response({'error': 'Not enrolled in this course'}, 
                          status=status.HTTP_403_FORBIDDEN)
    except Quiz.DoesNotExist:
        return Response({'error': 'Quiz not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Check attempt limit
    existing_attempts = QuizAttempt.objects.filter(quiz=quiz, student=request.user)
    if existing_attempts.count() >= quiz.max_attempts:
        return Response({'error': 'Maximum attempts reached'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    # Check if there's an incomplete attempt
    incomplete = existing_attempts.filter(is_completed=False).first()
    if incomplete:
        serializer = QuizAttemptSerializer(incomplete)
        return Response(serializer.data)
    
    # Create new attempt
    attempt_number = existing_attempts.count() + 1
    attempt = QuizAttempt.objects.create(
        quiz=quiz,
        student=request.user,
        attempt_number=attempt_number
    )
    
    serializer = QuizAttemptSerializer(attempt)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_quiz_questions(request, quiz_id, attempt_id):
    if not request.user.is_student:
        return Response({'error': 'Only students can view quiz questions'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        attempt = QuizAttempt.objects.get(id=attempt_id, student=request.user, quiz_id=quiz_id)
    except QuizAttempt.DoesNotExist:
        return Response({'error': 'Attempt not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if attempt.is_completed:
        return Response({'error': 'Quiz already completed'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    questions = Question.objects.filter(quiz=attempt.quiz).prefetch_related('choices')
    serializer = QuestionSerializer(questions, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def submit_quiz(request, quiz_id, attempt_id):
    if not request.user.is_student:
        return Response({'error': 'Only students can submit quizzes'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        attempt = QuizAttempt.objects.get(id=attempt_id, student=request.user, quiz_id=quiz_id)
    except QuizAttempt.DoesNotExist:
        return Response({'error': 'Attempt not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if attempt.is_completed:
        return Response({'error': 'Quiz already completed'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    submission_data = request.data.get('answers', [])
    if not submission_data:
        return Response({'error': 'Answers required'}, status=status.HTTP_400_BAD_REQUEST)
    
    total_score = 0
    total_points = 0
    
    # Process answers
    for answer_data in submission_data:
        question_id = answer_data.get('question_id')
        choice_id = answer_data.get('choice_id')
        
        try:
            question = Question.objects.get(id=question_id, quiz=attempt.quiz)
            choice = Choice.objects.get(id=choice_id, question=question) if choice_id else None
            
            is_correct = choice.is_correct if choice else False
            points_earned = question.points if is_correct else 0
            
            Answer.objects.create(
                attempt=attempt,
                question=question,
                selected_choice=choice,
                is_correct=is_correct,
                points_earned=points_earned
            )
            
            total_score += points_earned
            total_points += question.points
            
        except (Question.DoesNotExist, Choice.DoesNotExist):
            continue
    
    # Calculate percentage score
    percentage_score = (total_score / total_points * 100) if total_points > 0 else 0
    
    attempt.score = percentage_score
    attempt.submitted_at = timezone.now()
    attempt.is_completed = True
    attempt.save()
    
    serializer = QuizAttemptSerializer(attempt)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_quiz_attempts(request):
    if request.user.is_student:
        attempts = QuizAttempt.objects.filter(student=request.user)
    elif request.user.is_instructor:
        attempts = QuizAttempt.objects.filter(quiz__course__instructor=request.user)
    else:
        attempts = QuizAttempt.objects.all()
    
    serializer = QuizAttemptSerializer(attempts, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def quiz_results(request, quiz_id):
    try:
        quiz = Quiz.objects.get(id=quiz_id)
    except Quiz.DoesNotExist:
        return Response({'error': 'Quiz not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.user.is_student:
        attempts = QuizAttempt.objects.filter(quiz=quiz, student=request.user)
    elif request.user.is_instructor:
        if quiz.course.instructor != request.user:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        attempts = QuizAttempt.objects.filter(quiz=quiz)
    else:
        attempts = QuizAttempt.objects.filter(quiz=quiz)
    
    serializer = QuizAttemptSerializer(attempts, many=True)
    return Response(serializer.data)

