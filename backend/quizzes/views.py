from rest_framework import generics, status, permissions, serializers
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Count, Avg
from .models import (
    Quiz, Question, Choice, QuizAttempt, Answer,
    ChatSession, ChatMessage, ChatFile, PracticeSession,
)
from .serializers import (
    QuizSerializer, QuestionSerializer, ChoiceSerializer,
    QuizAttemptSerializer, QuizSubmissionSerializer,
    QuestionForAttemptSerializer, QuestionForReviewSerializer,
    ChatSessionSerializer, ChatSessionDetailSerializer,
    PracticeSessionSerializer, PracticeSessionDetailSerializer,
)
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

    subsection_ids = request.data.get('subsection_ids', [])
    num_questions = request.data.get('num_questions', 5)
    logger.info("[Generate] subsection_ids=%s, num_questions=%s", subsection_ids, num_questions)

    if not subsection_ids:
        return Response({'error': 'subsection_ids required (list of subsection IDs)'}, status=status.HTTP_400_BAD_REQUEST)

    subsections = Subsection.objects.filter(
        id__in=subsection_ids,
        pdf_file__isnull=False
    ).exclude(pdf_file='').select_related('section', 'section__course')

    if not subsections.exists():
        return Response({'error': 'No valid subsections with PDF found'}, status=status.HTTP_400_BAD_REQUEST)

    from quizzes.llm_service import extract_text_from_pdf, generate_questions_with_fallback

    lecture_contents = []
    for sub in subsections:
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
        return Response({'error': 'No lecture content could be extracted'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        questions = generate_questions_with_fallback(lecture_contents, num_questions=int(num_questions))
        logger.info("[Generate] LLM returned %d questions", len(questions or []))
    except Exception as e:
        logger.exception("[Generate] LLM error: %s", e)
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({'questions': questions or []})

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def chat_session_list(request):
    """List chat sessions for the current user."""
    sessions = ChatSession.objects.filter(user=request.user)
    serializer = ChatSessionSerializer(sessions, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def chat_session_detail(request, pk):
    """Return a single chat session with messages."""
    try:
        session = ChatSession.objects.get(id=pk, user=request.user)
    except ChatSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)
    serializer = ChatSessionDetailSerializer(session)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def chat_with_files(request):
    """
    Chat endpoint with optional uploaded files.
    - Reuses existing ChatSession when session_id is given.
    - New files are stored as ChatFile; previous files are reused.
    - Saves all messages to ChatMessage.
    """
    import tempfile
    from quizzes.llm_service import extract_text_from_pdf, generate_chat_reply_with_fallback

    message = (request.data.get('message') or '').strip()
    course_id = request.data.get('course_id')
    session_id = request.data.get('session_id')
    print(f"[Chat] user={request.user} course_id={course_id} session_id={session_id} message_len={len(message)}")

    if not message:
        return Response({'error': 'message is required'}, status=status.HTTP_400_BAD_REQUEST)

    course = None
    if course_id:
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)
        allowed = False
        if getattr(request.user, 'is_admin', False):
            allowed = True
        elif getattr(request.user, 'is_instructor', False) and course.instructor == request.user:
            allowed = True
        elif getattr(request.user, 'is_student', False) and Enrollment.objects.filter(
            student=request.user, course=course
        ).exists():
            allowed = True
        if not allowed:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    # Create or load session
    if session_id:
        try:
            session = ChatSession.objects.get(id=session_id, user=request.user)
        except ChatSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)
    else:
        session = ChatSession.objects.create(
            user=request.user,
            course=course,
            title=message[:80] or "New chat",
        )

    # Save user message
    ChatMessage.objects.create(session=session, role='user', content=message)

    # Attach any new files
    new_files = request.FILES.getlist('files') if hasattr(request.FILES, 'getlist') else []
    for f in new_files:
        cf = ChatFile.objects.create(session=session, file=f)
        print(f"[Chat] saved file {cf.file.name} to session {session.id}")

    # Build context from all files in this session
    lecture_contents = []
    for cf in session.files.all():
        name = cf.file.name
        lower = name.lower()
        try:
            if lower.endswith('.pdf'):
                text = extract_text_from_pdf(cf.file.path)
                lecture_contents.append({'title': name, 'text': text[:20000] if text else ''})
            else:
                raw = cf.file.read()
                cf.file.seek(0)
                try:
                    text = raw.decode('utf-8')
                except Exception:
                    text = raw.decode('latin-1', errors='ignore')
                lecture_contents.append({'title': name, 'text': text[:20000] if text else ''})
        except Exception as e:
            print(f"[Chat] Failed to read file {name}: {e}")
            continue

    # Call LLM
    try:
        reply = generate_chat_reply_with_fallback(message, lecture_contents)
    except Exception as e:
        print(f"[Chat] LLM error: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Save assistant message
    ChatMessage.objects.create(session=session, role='assistant', content=reply)

    return Response({
        'session': ChatSessionSerializer(session).data,
        'reply': reply,
    })

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def export_quiz(request, quiz_id):
    """Export quiz questions as CSV, XML, or GIFT format."""
    try:
        quiz = Quiz.objects.get(id=quiz_id)
    except Quiz.DoesNotExist:
        return Response({'error': 'Quiz not found'}, status=status.HTTP_404_NOT_FOUND)

    # Allow admin, instructor, or enrolled student to export
    allowed = False
    if getattr(request.user, 'is_admin', False):
        allowed = True
    elif getattr(request.user, 'is_instructor', False) and quiz.course.instructor == request.user:
        allowed = True
    elif getattr(request.user, 'is_student', False) and Enrollment.objects.filter(
        student=request.user, course=quiz.course
    ).exists():
        allowed = True
    if not allowed:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    fmt = (request.query_params.get('format') or 'csv').lower()
    questions = quiz.questions.all().prefetch_related('choices')

    from quizzes.export_import import export_csv, export_xml, export_gift

    if fmt == 'xml':
        content = export_xml(questions, quiz.title)
        resp = HttpResponse(content, content_type='application/xml')
        resp['Content-Disposition'] = f'attachment; filename="{quiz.title}_questions.xml"'
    elif fmt == 'gift':
        content = export_gift(questions)
        resp = HttpResponse(content, content_type='text/plain')
        resp['Content-Disposition'] = f'attachment; filename="{quiz.title}_questions.gift"'
    else:
        content = export_csv(questions)
        resp = HttpResponse(content, content_type='text/csv')
        resp['Content-Disposition'] = f'attachment; filename="{quiz.title}_questions.csv"'

    return resp


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def import_questions(request):
    """Parse uploaded file (CSV, XML, GIFT) and return questions for quiz creation."""
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


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def practice_session_list_create(request):
    """
    GET: list practice sessions for current student (optionally filter by course_id).
    POST: create a new practice session (generate questions and store them).
    """
    if request.method == 'GET':
        if not request.user.is_student:
            return Response({'error': 'Only students can view their practice sessions'}, status=status.HTTP_403_FORBIDDEN)
        qs = PracticeSession.objects.filter(student=request.user)
        course_id = request.query_params.get('course_id')
        if course_id:
            qs = qs.filter(course_id=course_id)
        serializer = PracticeSessionSerializer(qs, many=True)
        return Response(serializer.data)

    # POST: create session
    if not request.user.is_student:
        return Response({'error': 'Only students can create practice sessions'}, status=status.HTTP_403_FORBIDDEN)

    course_id = request.data.get('course_id')
    subsection_ids = request.data.get('subsection_ids') or []
    num_questions = request.data.get('num_questions', 5)

    if not course_id:
        return Response({'error': 'course_id is required'}, status=status.HTTP_400_BAD_REQUEST)
    if not subsection_ids:
        return Response({'error': 'subsection_ids is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        course = Course.objects.get(id=course_id)
    except Course.DoesNotExist:
        return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

    subsections = Subsection.objects.filter(
        id__in=subsection_ids,
        pdf_file__isnull=False
    ).exclude(pdf_file='').select_related('section', 'section__course')

    if not subsections.exists():
        return Response({'error': 'No valid subsections with PDF found'}, status=status.HTTP_400_BAD_REQUEST)

    from quizzes.llm_service import extract_text_from_pdf, generate_questions_with_fallback

    lecture_contents = []
    for sub in subsections:
        try:
            path = sub.pdf_file.path
        except (ValueError, AttributeError):
            continue
        text = extract_text_from_pdf(path)
        lecture_contents.append({
            'title': f"{sub.section.title} - {sub.title}",
            'text': text[:15000] if text else '[No text extracted]',
        })

    if not lecture_contents:
        return Response({'error': 'No lecture content could be extracted'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        questions = generate_questions_with_fallback(lecture_contents, num_questions=int(num_questions))
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    session = PracticeSession.objects.create(
        student=request.user,
        course=course,
        num_questions=len(questions),
        data={'questions': questions, 'answers': []},
    )

    return Response({
        'session': PracticeSessionDetailSerializer(session).data,
        'questions': questions,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def practice_session_detail(request, pk):
    try:
        session = PracticeSession.objects.get(id=pk, student=request.user)
    except PracticeSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)
    serializer = PracticeSessionDetailSerializer(session)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def practice_session_complete(request, pk):
    """Mark a practice session as completed with stats + answers."""
    if not request.user.is_student:
        return Response({'error': 'Only students can complete practice sessions'}, status=status.HTTP_403_FORBIDDEN)

    try:
        session = PracticeSession.objects.get(id=pk, student=request.user)
    except PracticeSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    num_correct = request.data.get('num_correct')
    duration_seconds = request.data.get('duration_seconds', 0)
    answers = request.data.get('answers') or []

    try:
       num_correct = int(num_correct)
       duration_seconds = int(duration_seconds)
    except Exception:
        return Response({'error': 'Invalid num_correct or duration_seconds'}, status=status.HTTP_400_BAD_REQUEST)

    session.num_correct = max(0, min(session.num_questions, num_correct))
    session.duration_seconds = max(0, duration_seconds)
    data = session.data or {}
    data['answers'] = answers
    session.data = data
    session.completed_at = timezone.now()
    session.save()

    return Response(PracticeSessionDetailSerializer(session).data)

