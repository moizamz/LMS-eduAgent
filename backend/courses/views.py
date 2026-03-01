from rest_framework import generics, status, permissions, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Q, Count, Avg
from .models import Course, Module, Enrollment, ModuleProgress, Section, Subsection, SubsectionProgress
from .serializers import (
    CourseSerializer, ModuleSerializer, EnrollmentSerializer, ModuleProgressSerializer,
    SectionSerializer, SectionCreateSerializer, SubsectionSerializer, SubsectionCreateSerializer,
    SubsectionProgressSerializer,
)


class CourseListView(generics.ListCreateAPIView):
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = Course.objects.all()
        
        # Students see only published courses
        if self.request.user.is_student:
            queryset = queryset.filter(is_published=True)
        # Instructors see their own courses
        elif self.request.user.is_instructor:
            queryset = queryset.filter(instructor=self.request.user)
        # Admins see all courses
        
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(description__icontains=search))
        
        return queryset.annotate(enrollment_count=Count('enrollments'))
    
    def perform_create(self, serializer):
        if self.request.user.is_instructor or self.request.user.is_admin:
            serializer.save(instructor=self.request.user)
        else:
            raise permissions.PermissionDenied("Only instructors and admins can create courses")


class CourseDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        if self.request.user.is_admin:
            return Course.objects.all()
        elif self.request.user.is_instructor:
            return Course.objects.filter(instructor=self.request.user)
        else:
            return Course.objects.filter(is_published=True)
    
    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]


class ModuleListView(generics.ListCreateAPIView):
    serializer_class = ModuleSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        course_id = self.request.query_params.get('course_id')
        if not course_id:
            return Module.objects.none()
        
        course = Course.objects.get(id=course_id)
        
        # Check permissions
        if self.request.user.is_student:
            # Students can only see modules of enrolled courses
            if not Enrollment.objects.filter(student=self.request.user, course=course).exists():
                return Module.objects.none()
        elif self.request.user.is_instructor:
            # Instructors can only see modules of their own courses
            if course.instructor != self.request.user:
                return Module.objects.none()
        
        return Module.objects.filter(course_id=course_id)
    
    def perform_create(self, serializer):
        course_id = self.request.data.get('course')
        if not course_id:
            raise serializers.ValidationError("course is required")
        
        course = Course.objects.get(id=course_id)
        if not (self.request.user.is_admin or course.instructor == self.request.user):
            raise permissions.PermissionDenied("Only course instructor can add modules")
        
        serializer.save()


class ModuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ModuleSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        if self.request.user.is_admin:
            return Module.objects.all()
        elif self.request.user.is_instructor:
            return Module.objects.filter(course__instructor=self.request.user)
        else:
            # Students can view modules of enrolled courses
            enrolled_courses = Enrollment.objects.filter(
                student=self.request.user
            ).values_list('course_id', flat=True)
            return Module.objects.filter(course_id__in=enrolled_courses)


# --- Section & Subsection (instructor content management) ---

class SectionListView(generics.ListCreateAPIView):
    serializer_class = SectionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return SectionCreateSerializer if self.request.method == 'POST' else SectionSerializer

    def get_queryset(self):
        course_id = self.request.query_params.get('course_id')
        if not course_id:
            return Section.objects.none()
        course = Course.objects.filter(id=course_id).first()
        if not course:
            return Section.objects.none()
        if self.request.user.is_admin:
            return Section.objects.filter(course_id=course_id)
        if self.request.user.is_instructor and course.instructor == self.request.user:
            return Section.objects.filter(course_id=course_id)
        if self.request.user.is_student:
            if Enrollment.objects.filter(student=self.request.user, course=course).exists():
                return Section.objects.filter(course_id=course_id)
        return Section.objects.none()

    def perform_create(self, serializer):
        course_id = self.request.data.get('course')
        if not course_id:
            raise serializers.ValidationError("course is required")
        course = Course.objects.get(id=course_id)
        if not (self.request.user.is_admin or course.instructor == self.request.user):
            raise permissions.PermissionDenied("Only course instructor can add sections")
        serializer.save()


class SectionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SectionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_admin:
            return Section.objects.all()
        if self.request.user.is_instructor:
            return Section.objects.filter(course__instructor=self.request.user)
        enrolled = Enrollment.objects.filter(student=self.request.user).values_list('course_id', flat=True)
        return Section.objects.filter(course_id__in=enrolled)


class SubsectionListView(generics.ListCreateAPIView):
    serializer_class = SubsectionSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_serializer_class(self):
        return SubsectionCreateSerializer if self.request.method == 'POST' else SubsectionSerializer

    def get_queryset(self):
        section_id = self.request.query_params.get('section_id')
        if not section_id:
            return Subsection.objects.none()
        section = Section.objects.filter(id=section_id).first()
        if not section:
            return Subsection.objects.none()
        if self.request.user.is_admin:
            return Subsection.objects.filter(section_id=section_id)
        if self.request.user.is_instructor and section.course.instructor == self.request.user:
            return Subsection.objects.filter(section_id=section_id)
        if self.request.user.is_student:
            if Enrollment.objects.filter(student=self.request.user, course=section.course).exists():
                return Subsection.objects.filter(section_id=section_id)
        return Subsection.objects.none()

    def perform_create(self, serializer):
        section_id = self.request.data.get('section')
        if not section_id:
            raise serializers.ValidationError("section is required")
        section = Section.objects.get(id=section_id)
        if not (self.request.user.is_admin or section.course.instructor == self.request.user):
            raise permissions.PermissionDenied("Only course instructor can add subsections")
        serializer.save()


class SubsectionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SubsectionSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        if self.request.user.is_admin:
            return Subsection.objects.all()
        if self.request.user.is_instructor:
            return Subsection.objects.filter(section__course__instructor=self.request.user)
        enrolled = Enrollment.objects.filter(student=self.request.user).values_list('course_id', flat=True)
        return Subsection.objects.filter(section__course_id__in=enrolled)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def enroll_course(request, course_id):
    if not request.user.is_student:
        return Response({'error': 'Only students can enroll'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        course = Course.objects.get(id=course_id, is_published=True)
    except Course.DoesNotExist:
        return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)
    
    enrollment, created = Enrollment.objects.get_or_create(
        student=request.user,
        course=course
    )
    
    if not created:
        return Response({'error': 'Already enrolled'}, status=status.HTTP_400_BAD_REQUEST)
    
    serializer = EnrollmentSerializer(enrollment)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_enrollments(request):
    if request.user.is_student:
        enrollments = Enrollment.objects.filter(student=request.user)
    elif request.user.is_instructor:
        enrollments = Enrollment.objects.filter(course__instructor=request.user)
    else:
        enrollments = Enrollment.objects.all()
    
    serializer = EnrollmentSerializer(enrollments, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_module_complete(request, enrollment_id, module_id):
    try:
        enrollment = Enrollment.objects.get(id=enrollment_id, student=request.user)
        module = Module.objects.get(id=module_id, course=enrollment.course)
    except (Enrollment.DoesNotExist, Module.DoesNotExist):
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
    
    progress, created = ModuleProgress.objects.get_or_create(
        enrollment=enrollment,
        module=module
    )
    progress.is_completed = True
    progress.save()
    
    # Update course progress
    total_modules = enrollment.course.modules.count()
    completed_modules = enrollment.module_progress.filter(is_completed=True).count()
    enrollment.progress_percentage = (completed_modules / total_modules * 100) if total_modules > 0 else 0
    
    if enrollment.progress_percentage >= 100:
        enrollment.is_completed = True
    enrollment.save()
    
    serializer = ModuleProgressSerializer(progress)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_subsection_complete(request, enrollment_id, subsection_id):
    try:
        enrollment = Enrollment.objects.get(id=enrollment_id, student=request.user)
        subsection = Subsection.objects.get(id=subsection_id, section__course=enrollment.course)
    except (Enrollment.DoesNotExist, Subsection.DoesNotExist):
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
    progress, created = SubsectionProgress.objects.get_or_create(
        enrollment=enrollment, subsection=subsection
    )
    progress.is_completed = True
    progress.save()
    total = Subsection.objects.filter(section__course=enrollment.course).count()
    completed = enrollment.subsection_progress.filter(is_completed=True).count()
    mod_total = enrollment.course.modules.count()
    mod_completed = enrollment.module_progress.filter(is_completed=True).count()
    total_items = total + mod_total
    completed_items = completed + mod_completed
    enrollment.progress_percentage = (completed_items / total_items * 100) if total_items > 0 else 0
    if enrollment.progress_percentage >= 100:
        enrollment.is_completed = True
    enrollment.save()
    return Response(SubsectionProgressSerializer(progress).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def course_progress(request, course_id):
    if not request.user.is_student:
        return Response({'error': 'Only students can view progress'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        enrollment = Enrollment.objects.get(student=request.user, course_id=course_id)
        module_progress = ModuleProgress.objects.filter(enrollment=enrollment)
        subsection_progress = SubsectionProgress.objects.filter(enrollment=enrollment)
        return Response({
            'enrollment': EnrollmentSerializer(enrollment).data,
            'module_progress': ModuleProgressSerializer(module_progress, many=True).data,
            'subsection_progress': SubsectionProgressSerializer(subsection_progress, many=True).data,
        })
    except Enrollment.DoesNotExist:
        return Response({'error': 'Not enrolled in this course'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def analytics(request):
    if not request.user.is_admin:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    from accounts.models import User
    
    total_users = User.objects.count()
    total_students = User.objects.filter(role='student').count()
    total_instructors = User.objects.filter(role='instructor').count()
    total_courses = Course.objects.count()
    total_enrollments = Enrollment.objects.count()
    avg_progress = Enrollment.objects.aggregate(avg=Avg('progress_percentage'))['avg'] or 0
    
    return Response({
        'total_users': total_users,
        'total_students': total_students,
        'total_instructors': total_instructors,
        'total_courses': total_courses,
        'total_enrollments': total_enrollments,
        'average_progress': round(avg_progress, 2),
    })

