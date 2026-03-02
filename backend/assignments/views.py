from rest_framework import generics, status, permissions, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.utils import timezone
from .models import Assignment, AssignmentSubmission
from .serializers import AssignmentSerializer, AssignmentSubmissionSerializer
from courses.models import Course, Enrollment


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


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
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
    
    # Check if already submitted
    submission, created = AssignmentSubmission.objects.get_or_create(
        assignment=assignment,
        student=request.user
    )
    
    if not created:
        return Response({'error': 'Already submitted. Update existing submission instead.'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    submission_file = request.FILES.get('submission_file')
    if submission_file and submission_file.size > 50 * 1024 * 1024:
        return Response({'error': 'File too large. Maximum size is 50MB.'},
                        status=status.HTTP_400_BAD_REQUEST)
    submission.submission_file = submission_file
    submission.submission_text = request.data.get('submission_text', '')
    submission.save()
    
    serializer = AssignmentSubmissionSerializer(submission)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['PUT', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
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
    if request.data.get('submission_text'):
        submission.submission_text = request.data['submission_text']
    submission.save()
    
    serializer = AssignmentSubmissionSerializer(submission)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_submissions(request):
    if request.user.is_student:
        submissions = AssignmentSubmission.objects.filter(student=request.user)
    elif request.user.is_instructor:
        submissions = AssignmentSubmission.objects.filter(
            assignment__course__instructor=request.user
        )
    else:
        submissions = AssignmentSubmission.objects.all()
    
    serializer = AssignmentSubmissionSerializer(submissions, many=True)
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
    serializer = AssignmentSubmissionSerializer(submissions, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def grade_submission(request, submission_id):
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
    
    submission.score = score
    submission.feedback = feedback
    submission.graded_by = request.user
    submission.graded_at = timezone.now()
    submission.is_graded = True
    submission.save()
    
    serializer = AssignmentSubmissionSerializer(submission)
    return Response(serializer.data)

