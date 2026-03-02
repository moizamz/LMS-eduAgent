from rest_framework import generics, status, permissions, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Count, Avg
from .models import Quiz, Question, Choice, QuizAttempt, Answer
from .serializers import (QuizSerializer, QuestionSerializer, ChoiceSerializer,
                         QuizAttemptSerializer, QuizSubmissionSerializer,
                         QuestionForAttemptSerializer, QuestionForReviewSerializer)
from courses.models import Course, Enrollment, Section, Subsection

print("===== VIEWS.PY LOADED =====")
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


class QuestionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = QuestionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_admin:
            return Question.objects.all()
        if self.request.user.is_instructor:
            return Question.objects.filter(quiz__course__instructor=self.request.user)
        return Question.objects.none()


class ChoiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ChoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_admin:
            return Choice.objects.all()
        if self.request.user.is_instructor:
            return Choice.objects.filter(question__quiz__course__instructor=self.request.user)
        return Choice.objects.none()


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
    serializer = QuestionForAttemptSerializer(questions, many=True)
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


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def generate_questions(request):
    """Generate MCQ questions from selected lecture PDFs using LLM."""
    import logging
    logger = logging.getLogger(__name__)
    logger.info("[Generate] Request received, user=%s", request.user.username)

    if not (request.user.is_admin or request.user.is_instructor):
        logger.warning("[Generate] Permission denied for user %s", request.user.username)
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    subsection_ids = request.data.get('subsection_ids', [])
    num_questions = request.data.get('num_questions', 5)
    logger.info("[Generate] subsection_ids=%s, num_questions=%s", subsection_ids, num_questions)

    if not subsection_ids:
        logger.warning("[Generate] No subsection_ids provided")
        return Response({'error': 'subsection_ids required (list of subsection IDs)'}, status=status.HTTP_400_BAD_REQUEST)

    subsections = Subsection.objects.filter(
        id__in=subsection_ids,
        pdf_file__isnull=False
    ).exclude(pdf_file='').select_related('section', 'section__course')

    logger.info("[Generate] Found %d subsections with PDF", subsections.count())
    if not subsections.exists():
        logger.warning("[Generate] No valid subsections with PDF found for ids=%s", subsection_ids)
        return Response({'error': 'No valid subsections with PDF found'}, status=status.HTTP_400_BAD_REQUEST)

    from quizzes.llm_service import extract_text_from_pdf

    lecture_contents = []
    for sub in subsections:
        if not (request.user.is_admin or sub.section.course.instructor == request.user):
            logger.info("[Generate] Skipping subsection %s - not instructor", sub.id)
            continue
        try:
            path = sub.pdf_file.path
            logger.info("[Generate] Extracting text from %s", path)
        except (ValueError, AttributeError) as e:
            logger.warning("[Generate] No path for subsection %s: %s", sub.id, e)
            continue
        text = extract_text_from_pdf(path)
        logger.info("[Generate] Extracted %d chars from subsection %s", len(text or ''), sub.id)
        lecture_contents.append({
            'title': f"{sub.section.title} - {sub.title}",
            'text': text[:15000] if text else '[No text extracted]',
        })

    if not lecture_contents:
        logger.warning("[Generate] No lecture content extracted")
        return Response({'error': 'No lecture content could be extracted'}, status=status.HTTP_400_BAD_REQUEST)

    logger.info("[Generate] Calling LLM with %d lectures, num_questions=%s", len(lecture_contents), num_questions)
    try:
        from quizzes.llm_service import generate_questions_from_content
        questions = generate_questions_from_content(lecture_contents, num_questions=int(num_questions))
        logger.info("[Generate] LLM returned %d questions", len(questions or []))
    except Exception as e:
        logger.exception("[Generate] LLM error: %s", e)
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({'questions': questions or []})

from django.views.decorators.http import require_GET
from django.contrib.auth.decorators import login_required

@require_GET
def export_quiz(request, quiz_id):
    print(f"[Export] HIT quiz_id={quiz_id}")
    try:
        quiz = Quiz.objects.get(id=quiz_id)
    except Quiz.DoesNotExist:
        from django.http import Http404
        raise Http404("Quiz not found")

    fmt = (request.GET.get('format') or 'csv').lower()
    questions = quiz.questions.all().prefetch_related('choices')

    from quizzes.export_import import export_csv, export_xml, export_gift

    if fmt == 'xml':
        content = export_xml(questions, quiz.title)
        resp = HttpResponse(content, content_type='application/xml')
        resp['Content-Disposition'] = f'attachment; filename="{quiz.title}.xml"'
    elif fmt == 'gift':
        content = export_gift(questions)
        resp = HttpResponse(content, content_type='text/plain')
        resp['Content-Disposition'] = f'attachment; filename="{quiz.title}.gift"'
    else:
        content = export_csv(questions)
        resp = HttpResponse(content, content_type='text/csv')
        resp['Content-Disposition'] = f'attachment; filename="{quiz.title}.csv"'

    return resp
# @api_view(['GET'])
# @permission_classes([permissions.IsAuthenticated])
# def export_quiz(request, quiz_id):
#     print(f"[Export] VIEW HIT quiz_id={quiz_id} user={request.user}")
#     try:
#         quiz = Quiz.objects.get(id=quiz_id)
#         print(f"[Export] Quiz found: {quiz.title}")
#     except Quiz.DoesNotExist:
#         print(f"[Export] Quiz {quiz_id} not found")
#         return Response({'error': 'Quiz not found'}, status=status.HTTP_404_NOT_FOUND)

#     print(f"[Export] Checking permissions for user={request.user}")
#     allowed = False
#     if getattr(request.user, "is_admin", False):
#         allowed = True
#         print("[Export] Allowed as admin")
#     elif getattr(request.user, "is_instructor", False) and quiz.course.instructor == request.user:
#         allowed = True
#         print("[Export] Allowed as instructor")
#     elif getattr(request.user, "is_student", False) and Enrollment.objects.filter(student=request.user, course=quiz.course).exists():
#         allowed = True
#         print("[Export] Allowed as student")

#     if not allowed:
#         print(f"[Export] PERMISSION DENIED user={request.user} is_admin={getattr(request.user,'is_admin',None)} is_instructor={getattr(request.user,'is_instructor',None)} is_student={getattr(request.user,'is_student',None)}")
#         return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

#     fmt = (request.query_params.get('format') or 'csv').lower()
#     print(f"[Export] Format: {fmt}")

#     questions = quiz.questions.all().prefetch_related('choices')
#     print(f"[Export] Questions count: {questions.count()}")

#     try:
#         from quizzes.export_import import export_csv, export_xml, export_gift
#         if fmt == 'csv':
#             content = export_csv(questions)
#             resp = HttpResponse(content, content_type='text/csv')
#             resp['Content-Disposition'] = f'attachment; filename="{quiz.title}_questions.csv"'
#             return resp
#         if fmt == 'xml':
#             content = export_xml(questions, quiz.title)
#             resp = HttpResponse(content, content_type='application/xml')
#             resp['Content-Disposition'] = f'attachment; filename="{quiz.title}_questions.xml"'
#             return resp
#         if fmt == 'gift':
#             content = export_gift(questions)
#             resp = HttpResponse(content, content_type='text/plain')
#             resp['Content-Disposition'] = f'attachment; filename="{quiz.title}_questions.gift"'
#             return resp
#         return Response({'error': 'Format must be csv, xml, or gift'}, status=400)
#     except Exception as e:
#         import traceback
#         print(f"[Export] EXCEPTION: {e}")
#         traceback.print_exc()
#         return Response({'error': str(e)}, status=500)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def import_questions(request):
    """Parse uploaded file (CSV, XML, GIFT) and return questions for quiz creation."""
    if not (request.user.is_admin or request.user.is_instructor):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    file_obj = request.FILES.get('file')
    fmt = (request.data.get('format') or request.POST.get('format') or 'csv').lower()
    if not file_obj:
        return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
    if fmt not in ('csv', 'xml', 'gift'):
        return Response({'error': 'Format must be csv, xml, or gift'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        content = file_obj.read().decode('utf-8')
    except UnicodeDecodeError:
        try:
            content = file_obj.read().decode('latin-1')
        except Exception:
            return Response({'error': 'Could not decode file'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        from quizzes.export_import import parse_import_file
        questions = parse_import_file(content, fmt)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    if not questions:
        return Response({'error': 'No valid questions found in file'}, status=status.HTTP_400_BAD_REQUEST)
    return Response({'questions': questions})


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

