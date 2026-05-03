import logging

from rest_framework import generics, status, permissions, serializers
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Count, Avg
from django.shortcuts import get_object_or_404
from .models import (
    Quiz, Question, Choice, QuizAttempt, Answer,
    ChatSession, ChatMessage, ChatFile, PracticeSession,
    StudentAdaptivePolicyState,
)
from .serializers import (
    QuizSerializer, QuestionSerializer, ChoiceSerializer,
    QuizAttemptSerializer, QuizSubmissionSerializer,
    QuestionForAttemptSerializer, QuestionForReviewSerializer,
    ChatSessionSerializer, ChatSessionDetailSerializer,
    PracticeSessionSerializer, PracticeSessionDetailSerializer,
)
from courses.models import Course, Enrollment, Section, Subsection
from django.views.decorators.http import require_GET

print("===== VIEWS.PY LOADED =====")


def _adaptive_prior_session_digest(student, course, limit=5):
    """Short lines about recent adaptive practice sessions for LLM context."""
    rows = []
    for sess in PracticeSession.objects.filter(student=student, course=course).order_by('-created_at')[:15]:
        d = sess.data or {}
        if d.get('mode') != 'adaptive':
            continue
        log = (d.get('adaptive') or {}).get('log') or []
        if not log:
            continue
        c = sum(1 for e in log if e.get('is_correct'))
        rows.append(f"prior session {sess.id}: {c}/{len(log)} correct adaptive items")
        if len(rows) >= limit:
            break
    return rows


def _learner_context_for_bank_prompt(astate: dict, prior_lines: list) -> str:
    """Human-readable block for adaptive bank generation (cross-session learning path)."""
    lines = []
    th = astate.get('topic_hist') or {}
    if th:
        lines.append('Per-topic adaptive accuracy (Bloom taxonomy):')
        for tax, cell in sorted(th.items(), key=lambda kv: -int((kv[1] or {}).get('n', 0)))[:10]:
            n = int((cell or {}).get('n', 0))
            c = int((cell or {}).get('c', 0))
            if n > 0:
                lines.append(f"  - {tax}: {c}/{n} correct ({100.0 * c / n:.0f}%)")
    try:
        lines.append(f"Estimated ability theta (IRT-lite): {float(astate.get('theta', 0.0)):.2f}")
    except (TypeError, ValueError):
        lines.append('Estimated ability theta (IRT-lite): 0.0')
    if prior_lines:
        lines.append('Recent adaptive practice sets:')
        lines.extend(f"  {ln}" for ln in prior_lines)
    return "\n".join(lines) if lines else ""


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

@api_view(['POST'])
@permission_classes([])
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


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def adaptive_practice_start(request):
    """
    Build a question bank via LLM, then start a practice session whose on-screen
    sequence is chosen online by hybrid Q-learning + UCB (with a linear TD head).
    """
    import random

    if not request.user.is_student:
        return Response({'error': 'Only students can start adaptive practice'}, status=status.HTTP_403_FORBIDDEN)

    course_id = request.data.get('course_id')
    subsection_ids = request.data.get('subsection_ids') or []
    try:
        num_questions = int(request.data.get('num_questions', 5))
    except (TypeError, ValueError):
        num_questions = 5
    try:
        bank_multiplier = int(request.data.get('bank_multiplier', 3))
    except (TypeError, ValueError):
        bank_multiplier = 3
    try:
        warmup_questions = int(request.data.get('warmup_questions', -1))
    except (TypeError, ValueError):
        warmup_questions = -1

    if not course_id:
        return Response({'error': 'course_id is required'}, status=status.HTTP_400_BAD_REQUEST)
    if not subsection_ids:
        return Response({'error': 'subsection_ids is required'}, status=status.HTTP_400_BAD_REQUEST)

    num_questions = max(1, min(30, num_questions))
    bank_multiplier = max(1, min(5, bank_multiplier))
    if warmup_questions < 0:
        warmup_questions = min(5, num_questions)
    warmup_questions = max(0, min(num_questions, warmup_questions))
    bank_size = min(45, max(num_questions * bank_multiplier, num_questions + 3))

    try:
        course = Course.objects.get(id=course_id)
    except Course.DoesNotExist:
        return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

    if not Enrollment.objects.filter(student=request.user, course=course).exists():
        return Response({'error': 'You are not enrolled in this course'}, status=status.HTTP_403_FORBIDDEN)

    subsections = Subsection.objects.filter(
        id__in=subsection_ids,
        pdf_file__isnull=False,
        section__course_id=course.id,
    ).exclude(pdf_file='').select_related('section', 'section__course')

    if not subsections.exists():
        return Response({'error': 'No valid subsections with PDF found for this course'}, status=status.HTTP_400_BAD_REQUEST)

    from quizzes.llm_service import extract_text_from_pdf, generate_adaptive_question_bank
    from quizzes.adaptive_practice import (
        accuracy_bucket,
        arm_index,
        build_warmup_bank_order,
        merge_loaded_policy,
        normalize_question,
        pack_state,
        sanitize_for_db_json,
        select_next_bank_id,
        shuffle_mcq_for_display,
        time_bucket,
        total_bandit_pulls,
    )

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

    pol, _ = StudentAdaptivePolicyState.objects.get_or_create(
        student=request.user,
        course=course,
        defaults={'q_table': {}, 'bandit': {}, 'lin_weights': [], 'ability_state': {}},
    )
    from quizzes.adaptive_theta import merge_ability_state

    astate_pre = merge_ability_state(getattr(pol, 'ability_state', None))
    prior_lines = _adaptive_prior_session_digest(request.user, course)
    learner_context = _learner_context_for_bank_prompt(astate_pre, prior_lines)

    try:
        pack = generate_adaptive_question_bank(
            lecture_contents,
            bank_size=bank_size,
            learner_context=learner_context or None,
        )
        raw_bank = pack.get('questions') or []
        quality_report = pack.get('quality_report') or {}
        chunk_catalog_ids = pack.get('chunk_catalog_ids') or []
    except Exception as e:
        logging.getLogger(__name__).exception(
            '[AdaptiveStart] generate_adaptive_question_bank failed user=%s course=%s bank_size=%s',
            getattr(request.user, 'pk', None),
            course_id,
            bank_size,
        )
        err_msg = str(e) or repr(e)
        return Response({'error': err_msg[:4000]}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    try:
        logging.getLogger(__name__).info(
            '[AdaptiveStart] bank_pack user=%s course=%s raw_bank=%s quality_provider=%s',
            getattr(request.user, 'pk', None),
            course_id,
            len(raw_bank or []),
            (quality_report or {}).get('provider'),
        )
        print(
            f"[AdaptiveStart] raw_bank={len(raw_bank or [])} "
            f"provider={(quality_report or {}).get('provider')}"
        )

        bank = [normalize_question(q, i) for i, q in enumerate(raw_bank or [])]
        if not bank:
            return Response({'error': 'No questions generated for adaptive bank'}, status=status.HTTP_400_BAD_REQUEST)

        q_table, bandit, lin_w = merge_loaded_policy(pol.q_table, pol.bandit, pol.lin_weights)

        from quizzes.adaptive_theta import bank_id_boost_map, merge_ability_state

        astate = merge_ability_state(getattr(pol, 'ability_state', None))
        boosts = bank_id_boost_map(bank, set(), astate)

        rng = random.Random()
        used: set = set()
        s0 = pack_state(2, time_bucket(None), accuracy_bucket(0, 0))
        tb_pulls = total_bandit_pulls(bandit)
        warmup_order = build_warmup_bank_order(bank, warmup_questions, rng)
        logging.getLogger(__name__).info(
            '[AdaptiveStart] warmup_order_len=%s num_questions=%s bank=%s',
            len(warmup_order),
            num_questions,
            len(bank),
        )
        print(f"[AdaptiveStart] warmup_order_len={len(warmup_order)} num_questions={num_questions} bank={len(bank)}")

        if warmup_order:
            bid = int(warmup_order[0])
            first_q = next((q for q in bank if int(q['bank_id']) == bid), None)
            if first_q is None:
                return Response({'error': 'Could not resolve warmup question in bank'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            arm = arm_index(str(first_q.get('difficulty', 'medium')), str(first_q.get('taxonomy', 'understand')))
            used.add(bid)
        else:
            bid, arm = select_next_bank_id(s0, q_table, bandit, lin_w, bank, used, rng, tb_pulls, bank_boost=boosts)
            logging.getLogger(__name__).info(
                '[AdaptiveStart] select_next_bank_id bid=%s arm=%s bank=%s tb_pulls=%s',
                bid,
                arm,
                len(bank),
                tb_pulls,
            )
            print(f"[AdaptiveStart] select_next bid={bid} arm={arm} bank_len={len(bank)} tb_pulls={tb_pulls}")
            if bid < 0:
                return Response({'error': 'Could not select a question from bank'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            used.add(bid)
            first_q = next((q for q in bank if int(q['bank_id']) == bid), None)
            if first_q is None:
                return Response({'error': 'Could not resolve selected question in bank'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        display_q = shuffle_mcq_for_display(first_q, random.Random())

        session_payload = sanitize_for_db_json(
            {
                'mode': 'adaptive',
                'bank': bank,
                'used_bids': sorted(used),
                'quality_report': quality_report,
                'chunk_catalog_ids': chunk_catalog_ids,
                'theta_trace': [float(astate.get('theta', 0.0))],
                'adaptive': {
                    'last_state': s0,
                    'last_arm': arm,
                    'pending_bid': bid,
                    'answered': 0,
                    'session_correct': 0,
                    'log': [],
                    'warmup_order': warmup_order,
                },
            }
        )

        try:
            session = PracticeSession.objects.create(
                student=request.user,
                course=course,
                num_questions=num_questions,
                num_correct=0,
                data=session_payload,
            )
        except Exception as exc:
            logging.getLogger(__name__).exception('adaptive_practice_start: failed to persist session')
            return Response(
                {'error': f'Failed to save practice session: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        payload = sanitize_for_db_json(
            {
                'session_id': session.id,
                'total_questions': num_questions,
                'bank_size': len(bank),
                'warmup_questions': len(warmup_order),
                'selection_first': 'warmup' if warmup_order else 'policy',
                'question': display_q,
                'policy': 'hybrid_tabular_q_ucb_linear_td_theta_topic_balance',
                'quality_preview': {
                    'faithfulness_pct': quality_report.get('faithfulness_pct_display'),
                    'coverage_blueprint_pct': quality_report.get('coverage_blueprint_pct'),
                    'latency_ms': quality_report.get('latency_ms'),
                },
            }
        )
        logging.getLogger(__name__).info(
            '[AdaptiveStart] created session_id=%s num_questions=%s',
            session.id,
            num_questions,
        )
        print(f"[AdaptiveStart] created session_id={session.id}")
        return Response(payload, status=status.HTTP_201_CREATED)
    except Exception as exc:
        logging.getLogger(__name__).exception(
            '[AdaptiveStart] after bank generation user=%s course=%s',
            getattr(request.user, 'pk', None),
            course_id,
        )
        err_msg = str(exc) or repr(exc)
        return Response({'error': err_msg[:4000]}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def adaptive_practice_step(request, pk):
    """After answering the current question, update the policy and receive the next one (if any)."""
    import random

    if not request.user.is_student:
        return Response({'error': 'Only students can continue adaptive practice'}, status=status.HTTP_403_FORBIDDEN)

    try:
        session = PracticeSession.objects.get(id=pk, student=request.user)
    except PracticeSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    data = session.data or {}
    if data.get('mode') != 'adaptive':
        return Response({'error': 'Not an adaptive practice session'}, status=status.HTTP_400_BAD_REQUEST)

    is_correct = request.data.get('is_correct')
    time_seconds = request.data.get('time_seconds')
    if is_correct is None:
        return Response({'error': 'is_correct is required'}, status=status.HTTP_400_BAD_REQUEST)

    is_correct = bool(is_correct)

    from quizzes.adaptive_practice import (
        accuracy_bucket,
        arm_index,
        bandit_update,
        merge_loaded_policy,
        pack_state,
        q_learning_update,
        select_next_bank_id,
        shaped_reward,
        shuffle_mcq_for_display,
        td_update_lin,
        time_bucket,
        total_bandit_pulls,
    )
    from quizzes.adaptive_theta import bank_id_boost_map, merge_ability_state, record_topic_outcome, update_theta

    ad = data.get('adaptive') or {}
    bank = data.get('bank') or []
    if not bank or not isinstance(ad, dict):
        return Response({'error': 'Corrupt session data'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        pending_bid = int(ad.get('pending_bid', -1))
        last_state = int(ad.get('last_state', 0))
        last_arm = int(ad.get('last_arm', 0))
        answered = int(ad.get('answered', 0))
        session_correct = int(ad.get('session_correct', 0))
    except (TypeError, ValueError):
        return Response({'error': 'Invalid adaptive session state'}, status=status.HTTP_400_BAD_REQUEST)

    pol = StudentAdaptivePolicyState.objects.filter(student=request.user, course=session.course).first()
    if not pol:
        pol = StudentAdaptivePolicyState.objects.create(
            student=request.user,
            course=session.course,
            q_table={},
            bandit={},
            lin_weights=[],
            ability_state={},
        )

    q_table, bandit, lin_w = merge_loaded_policy(pol.q_table, pol.bandit, pol.lin_weights)

    prev_q = next((x for x in bank if int(x.get('bank_id', -1)) == pending_bid), None)
    astate = merge_ability_state(getattr(pol, 'ability_state', None))
    if prev_q:
        record_topic_outcome(astate, prev_q, is_correct)
        astate['theta'] = update_theta(float(astate.get('theta', 0.0)), is_correct, str(prev_q.get('difficulty', 'medium')))

    r = shaped_reward(is_correct, time_seconds)
    answered_next = answered + 1
    session_correct_next = session_correct + (1 if is_correct else 0)
    prev_code = 1 if is_correct else 0
    tb = time_bucket(time_seconds)
    acc_b = accuracy_bucket(session_correct_next, answered_next)
    s_next = pack_state(prev_code, tb, acc_b)

    q_learning_update(q_table, last_state, last_arm, r, s_next)
    bandit_update(bandit, last_arm, r)
    td_update_lin(lin_w, last_state, last_arm, r, s_next)

    pol.q_table = q_table
    pol.bandit = bandit
    pol.lin_weights = lin_w
    pol.ability_state = astate
    pol.save()

    log = list(ad.get('log') or [])
    log.append({
        'bank_id': pending_bid,
        'is_correct': is_correct,
        'time_seconds': time_seconds,
        'reward': r,
    })

    ad['answered'] = answered_next
    ad['session_correct'] = session_correct_next
    ad['log'] = log

    before_trace = list(data.get('theta_trace') or [])
    theta_session_start = float(before_trace[0]) if before_trace else float(astate.get('theta', 0.0))
    trace = before_trace + [float(astate.get('theta', 0.0))]
    data['theta_trace'] = trace[-80:]

    if answered_next >= session.num_questions:
        data['adaptive'] = ad
        session.data = data
        session.save(update_fields=['data'])
        return Response({
            'done': True,
            'step': answered_next,
            'session_correct': session_correct_next,
            'theta': float(astate.get('theta', 0.0)),
            'theta_delta_session': round(float(astate.get('theta', 0.0)) - theta_session_start, 4),
        })

    used = set(int(x) for x in (data.get('used_bids') or []))
    rng = random.Random()
    tb_pulls = total_bandit_pulls(bandit)
    boosts = bank_id_boost_map(bank, used, astate)
    warmup_order = []
    for x in ad.get('warmup_order') or []:
        try:
            warmup_order.append(int(x))
        except (TypeError, ValueError):
            continue
    next_q = None
    if warmup_order and answered_next < len(warmup_order):
        next_bid = int(warmup_order[answered_next])
        next_q = next((q for q in bank if int(q.get('bank_id', -1)) == next_bid), None)
        if next_q is None:
            logging.getLogger(__name__).error(
                '[AdaptiveStep] warmup bid %s missing from bank session=%s',
                next_bid,
                session.id,
            )
            data['adaptive'] = ad
            session.data = data
            session.save(update_fields=['data'])
            return Response(
                {'error': 'Warmup question missing from bank', 'done': True, 'bank_exhausted': True},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        next_arm = arm_index(str(next_q.get('difficulty', 'medium')), str(next_q.get('taxonomy', 'understand')))
        logging.getLogger(__name__).info(
            '[AdaptiveStep] warmup pick session=%s answered_next=%s bid=%s',
            session.id,
            answered_next,
            next_bid,
        )
    else:
        next_bid, next_arm = select_next_bank_id(s_next, q_table, bandit, lin_w, bank, used, rng, tb_pulls, bank_boost=boosts)
    if next_bid < 0:
        data['adaptive'] = ad
        session.data = data
        session.save(update_fields=['data'])
        return Response({
            'done': True,
            'step': answered_next,
            'session_correct': session_correct_next,
            'bank_exhausted': True,
            'theta': float(astate.get('theta', 0.0)),
            'theta_delta_session': round(float(astate.get('theta', 0.0)) - theta_session_start, 4),
        })

    used.add(next_bid)
    data['used_bids'] = sorted(used)
    ad['last_state'] = s_next
    ad['last_arm'] = next_arm
    ad['pending_bid'] = next_bid
    data['adaptive'] = ad
    session.data = data
    session.save(update_fields=['data'])

    if next_q is None:
        next_q = next((q for q in bank if int(q.get('bank_id', -1)) == next_bid), None)
    if next_q is None:
        logging.getLogger(__name__).error('[AdaptiveStep] next_q None bid=%s session=%s', next_bid, session.id)
        return Response({'error': 'Next question not found in bank', 'done': True}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    display_next = shuffle_mcq_for_display(next_q, random.Random())
    sel_mode = 'warmup' if (warmup_order and answered_next < len(warmup_order)) else 'policy'
    return Response({
        'done': False,
        'step': answered_next + 1,
        'total_questions': session.num_questions,
        'question': display_next,
        'session_correct': session_correct_next,
        'theta': float(astate.get('theta', 0.0)),
        'selection': sel_mode,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def adaptive_learning_insights(request, course_id):
    """
    Pilot metrics, θ/topic analytics, weak-topic recommendations, generation quality aggregates.
    """
    if not request.user.is_student:
        return Response({'error': 'Only students'}, status=status.HTTP_403_FORBIDDEN)
    course = get_object_or_404(Course, id=course_id)
    if not Enrollment.objects.filter(student=request.user, course=course).exists():
        return Response({'error': 'Not enrolled'}, status=status.HTTP_403_FORBIDDEN)

    pol = StudentAdaptivePolicyState.objects.filter(student=request.user, course=course).first()
    ability = pol.ability_state if pol and isinstance(pol.ability_state, dict) else {}
    theta_now = float(ability.get('theta', 0.0))
    topic_hist = ability.get('topic_hist') or {}
    stratum_acc = ability.get('stratum_accuracy') or {}

    sessions = list(
        PracticeSession.objects.filter(student=request.user, course=course)
        .order_by('-created_at')[:30]
    )

    latencies = []
    faiths = []
    coverages = []
    for s in sessions:
        d = s.data or {}
        if d.get('mode') != 'adaptive':
            continue
        qr = d.get('quality_report') or {}
        if qr.get('latency_ms') is not None:
            latencies.append(int(qr['latency_ms']))
        if qr.get('faithfulness_mean') is not None:
            faiths.append(float(qr['faithfulness_mean']))
        if qr.get('coverage_blueprint_pct') is not None:
            coverages.append(float(qr['coverage_blueprint_pct']))

    def pctile(arr, p):
        if not arr:
            return None
        xs = sorted(arr)
        k = max(0, min(len(xs) - 1, int(round((p / 100.0) * (len(xs) - 1)))))
        return xs[k]

    weak_topics = []
    for tax, cell in topic_hist.items():
        n = int(cell.get('n', 0))
        c = int(cell.get('c', 0))
        if n < 2:
            continue
        p = c / max(1, n)
        weak_topics.append(
            {
                'taxonomy': tax,
                'attempts': n,
                'accuracy': round(p * 100, 1),
                'priority': round(max(0.0, 0.65 - p), 3),
            }
        )
    weak_topics.sort(key=lambda x: x['priority'], reverse=True)

    stratum_psych = []
    for sk, cell in stratum_acc.items():
        n = int(cell.get('n', 0))
        c = int(cell.get('c', 0))
        if n <= 0:
            continue
        p_val = c / n
        disc = None
        if n >= 8:
            disc = round(min(1.0, max(-1.0, 2.0 * (p_val - 0.5))), 3)
        stratum_psych.append(
            {
                'stratum': sk,
                'n': n,
                'p_value_empirical': round(p_val, 3),
                'discrimination_proxy': disc,
            }
        )
    stratum_psych.sort(key=lambda x: -x['n'])

    last_quiz = (
        QuizAttempt.objects.filter(student=request.user, quiz__course=course, is_completed=True)
        .order_by('-submitted_at')
        .first()
    )
    post_test_hint = None
    if last_quiz and last_quiz.score is not None:
        post_test_hint = {'last_quiz_score': float(last_quiz.score), 'quiz_title': last_quiz.quiz.title}

    theta_deltas = []
    for s in sessions:
        d = s.data or {}
        tr = d.get('theta_trace') or []
        if len(tr) >= 2:
            theta_deltas.append(float(tr[-1]) - float(tr[0]))

    recommendations = []
    for w in weak_topics[:5]:
        recommendations.append(
            {
                'title': f"Strengthen: {w['taxonomy'].replace('_', ' ').title()}",
                'detail': f"Accuracy {w['accuracy']}% over {w['attempts']} adaptive items — schedule focused review and short drills on this Bloom level.",
            }
        )

    latest_bank_quality = None
    for s in sessions:
        d = s.data or {}
        if d.get('mode') == 'adaptive' and d.get('quality_report'):
            latest_bank_quality = d['quality_report']
            break

    return Response(
        {
            'course_id': course.id,
            'theta': theta_now,
            'topic_mastery': topic_hist,
            'weak_topics': weak_topics,
            'recommendations': recommendations,
            'latest_bank_quality': latest_bank_quality,
            'stratum_psychometrics': stratum_psych,
            'generation_latency': {
                'p50_ms': pctile(latencies, 50),
                'p95_ms': pctile(latencies, 95),
                'samples': len(latencies),
            },
            'faithfulness_series_mean': round(sum(faiths) / len(faiths), 3) if faiths else None,
            'coverage_series_mean': round(sum(coverages) / len(coverages), 1) if coverages else None,
            'theta_session_deltas': theta_deltas[:15],
            'adaptive_effectiveness_note': 'theta_delta compares end vs start of each adaptive session trace.',
            'human_review': {'sample_pct': 5, 'status': 'not_scheduled'},
            'post_test': post_test_hint,
            'policy_engine': 'hybrid_tabular_q_ucb_linear_td_theta_topic_balance',
        }
    )

