from rest_framework import generics, status, permissions, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db import models
from .models import Announcement, Notification
from .serializers import AnnouncementSerializer, NotificationSerializer
from courses.models import Course, Enrollment


class AnnouncementListView(generics.ListCreateAPIView):
    serializer_class = AnnouncementSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        course_id = self.request.query_params.get('course_id')
        
        if self.request.user.is_student:
            # Students see platform-wide announcements and announcements for enrolled courses
            enrolled_courses = Enrollment.objects.filter(
                student=self.request.user
            ).values_list('course_id', flat=True)
            queryset = Announcement.objects.filter(
                is_active=True
            ).filter(
                models.Q(course__isnull=True) | models.Q(course_id__in=enrolled_courses)
            )
        elif self.request.user.is_instructor:
            # Instructors see platform-wide and their own course announcements
            queryset = Announcement.objects.filter(
                models.Q(course__isnull=True) | models.Q(course__instructor=self.request.user)
            )
        else:
            # Admins see all
            queryset = Announcement.objects.all()
        
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        
        return queryset
    
    def perform_create(self, serializer):
        course_id = serializer.validated_data.get('course_id')
        
        if course_id:
            course = Course.objects.get(id=course_id)
            if self.request.user.is_instructor and course.instructor != self.request.user:
                raise permissions.PermissionDenied("Can only create announcements for your own courses")
        
        serializer.save(created_by=self.request.user)


class AnnouncementDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AnnouncementSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        if self.request.user.is_admin:
            return Announcement.objects.all()
        elif self.request.user.is_instructor:
            return Announcement.objects.filter(
                models.Q(course__instructor=self.request.user) | models.Q(course__isnull=True, created_by=self.request.user)
            )
        else:
            enrolled_courses = Enrollment.objects.filter(
                student=self.request.user
            ).values_list('course_id', flat=True)
            return Announcement.objects.filter(
                is_active=True
            ).filter(
                models.Q(course__isnull=True) | models.Q(course_id__in=enrolled_courses)
            )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_notifications(request):
    notifications = Notification.objects.filter(user=request.user)
    unread_count = notifications.filter(is_read=False).count()
    
    serializer = NotificationSerializer(notifications, many=True)
    return Response({
        'notifications': serializer.data,
        'unread_count': unread_count
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_notification_read(request, notification_id):
    try:
        notification = Notification.objects.get(id=notification_id, user=request.user)
        notification.is_read = True
        notification.save()
        return Response({'message': 'Notification marked as read'})
    except Notification.DoesNotExist:
        return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_all_notifications_read(request):
    Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return Response({'message': 'All notifications marked as read'})

