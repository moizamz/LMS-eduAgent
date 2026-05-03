import io
import logging
import re

from django.http import FileResponse
from django.utils import timezone
from rest_framework import generics, status, permissions, serializers
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Assignment, AssignmentSubmission
from .serializers import AssignmentSerializer, AssignmentSubmissionSerializer
from courses.models import Course, Enrollment

_log = logging.getLogger(__name__)


class AssignmentListView(generics.ListCreateAPIView):
    serializer_class = AssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def get_queryset(self):
        course_id = self.request.query_params.get('course_id')
        if not course_id:
            return Assignment.objects.none()
        
        course = Course.objects.get(id=course_id)
        
        # Check permissions
        if self.request.user.is_student:
            # Students can only see assignments of enrolled courses
            if not Enrollment.objects.filter(student=self.request.user, course=course).exists():
                return Assignment.objects.none()
        elif self.request.user.is_instructor:
            # Instructors can only see assignments of their own courses
            if course.instructor != self.request.user:
                return Assignment.objects.none()
        
        return Assignment.objects.filter(course_id=course_id)
    
    def perform_create(self, serializer):
        course_id = self.request.data.get('course_id')
        if not course_id:
            raise serializers.ValidationError("course_id is required")
        
        course = Course.objects.get(id=course_id)
        if not (self.request.user.is_admin or course.instructor == self.request.user):
            raise permissions.PermissionDenied("Only course instructor can create assignments")
        
        serializer.save()


class AssignmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def get_queryset(self):
        if self.request.user.is_admin:
            return Assignment.objects.all()
        elif self.request.user.is_instructor:
            return Assignment.objects.filter(course__instructor=self.request.user)
        else:
            enrolled_courses = Enrollment.objects.filter(
                student=self.request.user
            ).values_list('course_id', flat=True)
            return Assignment.objects.filter(course_id__in=enrolled_courses)

    def perform_update(self, serializer):
        if not (self.request.user.is_admin or self.request.user.is_instructor):
            raise permissions.PermissionDenied('Only instructors can update assignments.')
        if self.request.user.is_instructor and serializer.instance.course.instructor_id != self.request.user.id:
            raise permissions.PermissionDenied('You can only edit assignments in your own courses.')
        serializer.save()

    def perform_destroy(self, instance):
        if not (self.request.user.is_admin or self.request.user.is_instructor):
            raise permissions.PermissionDenied('Only instructors can delete assignments.')
        if self.request.user.is_instructor and instance.course.instructor_id != self.request.user.id:
            raise permissions.PermissionDenied('You can only delete assignments in your own courses.')
        instance.delete()


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def submit_assignment(request, assignment_id):
    if not request.user.is_student:
        return Response({'error': 'Only students can submit assignments'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        assignment = Assignment.objects.get(id=assignment_id)
        # Check if student is enrolled
        if not Enrollment.objects.filter(student=request.user, course=assignment.course).exists():
            return Response({'error': 'Not enrolled in this course'}, 
                          status=status.HTTP_403_FORBIDDEN)
    except Assignment.DoesNotExist:
        return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)
    
    submission, created = AssignmentSubmission.objects.get_or_create(
        assignment=assignment,
        student=request.user
    )

    if submission.is_graded:
        return Response(
            {'error': 'This assignment has been graded. You can no longer change your submission.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    submission_file = request.FILES.get('submission_file')
    if submission_file and submission_file.size > 50 * 1024 * 1024:
        return Response({'error': 'File too large. Maximum size is 50MB.'},
                        status=status.HTTP_400_BAD_REQUEST)
    if submission_file is not None:
        submission.submission_file = submission_file
    if 'submission_text' in request.data:
        submission.submission_text = request.data.get('submission_text') or ''
    elif created:
        submission.submission_text = ''

    submission.save()

    serializer = AssignmentSubmissionSerializer(submission, context={'request': request})
    return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(['PUT', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def update_submission(request, submission_id):
    if not request.user.is_student:
        return Response({'error': 'Only students can update submissions'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        submission = AssignmentSubmission.objects.get(id=submission_id, student=request.user)
    except AssignmentSubmission.DoesNotExist:
        return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if submission.is_graded:
        return Response({'error': 'Cannot update graded submission'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    if request.FILES.get('submission_file'):
        submission_file = request.FILES['submission_file']
        if submission_file.size > 50 * 1024 * 1024:
            return Response({'error': 'File too large. Maximum size is 50MB.'},
                            status=status.HTTP_400_BAD_REQUEST)
        submission.submission_file = submission_file
    if 'submission_text' in request.data:
        submission.submission_text = request.data.get('submission_text') or ''
    submission.save()

    serializer = AssignmentSubmissionSerializer(submission, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_submissions(request):
    course_id = request.query_params.get('course_id')
    if request.user.is_student:
        submissions = AssignmentSubmission.objects.filter(student=request.user)
        if course_id:
            submissions = submissions.filter(assignment__course_id=course_id)
    elif request.user.is_instructor:
        submissions = AssignmentSubmission.objects.filter(
            assignment__course__instructor=request.user
        )
    else:
        submissions = AssignmentSubmission.objects.all()
    
    serializer = AssignmentSubmissionSerializer(submissions, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def ai_grade_submission(request, submission_id):
    """
    Instructor/admin: run LLM on instruction file + submission, store result on submission.ai_grading
    (does not finalize score until approve endpoint or manual grade).
    """
    if not (request.user.is_instructor or request.user.is_admin):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    try:
        submission = AssignmentSubmission.objects.select_related('assignment', 'assignment__course').get(
            id=submission_id
        )
    except AssignmentSubmission.DoesNotExist:
        return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.user.is_instructor and submission.assignment.course.instructor != request.user:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    if submission.is_graded:
        return Response({'error': 'Submission is already graded.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        from .ai_grading import run_ai_grade_for_submission

        payload = run_ai_grade_for_submission(submission)
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        _log.exception('[AIGrade] failed submission_id=%s', submission_id)
        return Response({'error': str(e)[:2000]}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    submission.ai_grading = payload
    submission.save(update_fields=['ai_grading'])

    serializer = AssignmentSubmissionSerializer(submission, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def approve_ai_grade(request, submission_id):
    """Apply AI-suggested (or overridden) score and feedback and mark submission graded."""
    if not (request.user.is_instructor or request.user.is_admin):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    try:
        submission = AssignmentSubmission.objects.select_related('assignment', 'assignment__course').get(
            id=submission_id
        )
    except AssignmentSubmission.DoesNotExist:
        return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.user.is_instructor and submission.assignment.course.instructor != request.user:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    if submission.is_graded:
        return Response({'error': 'Submission is already graded.'}, status=status.HTTP_400_BAD_REQUEST)

    ai = submission.ai_grading or {}
    has_rubric = isinstance(ai.get('rubric'), list) and len(ai.get('rubric')) > 0
    if not ai or (not has_rubric and 'suggested_score' not in ai):
        return Response({'error': 'No AI grading to approve. Run "Grade using AI" first.'}, status=status.HTTP_400_BAD_REQUEST)

    max_sc = float(submission.assignment.max_score or 100)
    score = request.data.get('score', ai.get('suggested_score'))
    try:
        score = float(score)
    except (TypeError, ValueError):
        return Response({'error': 'Invalid score'}, status=status.HTTP_400_BAD_REQUEST)
    if score < 0 or score > max_sc:
        return Response({'error': f'Score must be between 0 and {max_sc}'}, status=status.HTTP_400_BAD_REQUEST)

    feedback_in = request.data.get('feedback')
    if feedback_in is not None and str(feedback_in).strip():
        feedback = str(feedback_in).strip()
    else:
        expl = str(ai.get('overall_explanation') or '').strip()
        feedback = expl if expl else 'Graded with AI assistance.'

    submission.score = score
    submission.feedback = feedback[:20000] if feedback else ''
    submission.graded_by = request.user
    submission.graded_at = timezone.now()
    submission.is_graded = True
    submission.save(update_fields=['score', 'feedback', 'graded_by', 'graded_at', 'is_graded'])

    serializer = AssignmentSubmissionSerializer(submission, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def assignment_submissions(request, assignment_id):
    try:
        assignment = Assignment.objects.get(id=assignment_id)
    except Assignment.DoesNotExist:
        return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Check permissions
    if request.user.is_student:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    if request.user.is_instructor and assignment.course.instructor != request.user:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    submissions = AssignmentSubmission.objects.filter(assignment=assignment)
    serializer = AssignmentSubmissionSerializer(submissions, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def grade_submission(request, submission_id):
    """Set or update final score/feedback (instructor/admin). Allows edits after a grade was posted."""
    if not (request.user.is_instructor or request.user.is_admin):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        submission = AssignmentSubmission.objects.get(id=submission_id)
    except AssignmentSubmission.DoesNotExist:
        return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Check if instructor owns the course
    if request.user.is_instructor and submission.assignment.course.instructor != request.user:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    score = request.data.get('score')
    feedback = request.data.get('feedback', '')
    
    if score is None:
        return Response({'error': 'Score is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        score = float(score)
        if score < 0 or score > submission.assignment.max_score:
            return Response({'error': f'Score must be between 0 and {submission.assignment.max_score}'}, 
                          status=status.HTTP_400_BAD_REQUEST)
    except ValueError:
        return Response({'error': 'Invalid score'}, status=status.HTTP_400_BAD_REQUEST)
    
    fb = feedback if isinstance(feedback, str) else str(feedback or '')
    submission.score = score
    submission.feedback = fb[:20000] if fb else ''
    submission.graded_by = request.user
    submission.graded_at = timezone.now()
    submission.is_graded = True
    submission.save(update_fields=['score', 'feedback', 'graded_by', 'graded_at', 'is_graded'])

    serializer = AssignmentSubmissionSerializer(submission, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def download_ai_grading_pdf(request, submission_id):
    if not (request.user.is_instructor or request.user.is_admin):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    try:
        submission = AssignmentSubmission.objects.select_related(
            'assignment', 'assignment__course', 'student'
        ).get(id=submission_id)
    except AssignmentSubmission.DoesNotExist:
        return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)
    if request.user.is_instructor and submission.assignment.course.instructor_id != request.user.id:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    if not submission.ai_grading:
        return Response({'error': 'No AI grading stored for this submission.'}, status=status.HTTP_400_BAD_REQUEST)

    from .ai_grading_pdf import build_ai_grading_pdf_bytes

    pdf_bytes = build_ai_grading_pdf_bytes(submission)
    uname = re.sub(r'[^a-zA-Z0-9_-]+', '_', getattr(submission.student, 'username', '') or 'student')[:80]
    fname = f'ai_grading_sub{submission.id}_{uname}.pdf'
    return FileResponse(
        io.BytesIO(pdf_bytes),
        as_attachment=True,
        filename=fname,
        content_type='application/pdf',
    )

