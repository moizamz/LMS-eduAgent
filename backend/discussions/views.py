from rest_framework import generics, status, permissions, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import Discussion, Comment
from .serializers import DiscussionSerializer, CommentSerializer
from courses.models import Course, Enrollment


class DiscussionListView(generics.ListCreateAPIView):
    serializer_class = DiscussionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        course_id = self.request.query_params.get('course_id')
        if not course_id:
            return Discussion.objects.none()
        
        course = Course.objects.get(id=course_id)
        
        # Check permissions
        if self.request.user.is_student:
            if not Enrollment.objects.filter(student=self.request.user, course=course).exists():
                return Discussion.objects.none()
        
        return Discussion.objects.filter(course_id=course_id)
    
    def perform_create(self, serializer):
        course_id = self.request.data.get('course_id')
        if not course_id:
            raise serializers.ValidationError("course_id is required")
        
        course = Course.objects.get(id=course_id)
        
        # Check if student is enrolled or user is instructor/admin
        if self.request.user.is_student:
            if not Enrollment.objects.filter(student=self.request.user, course=course).exists():
                raise permissions.PermissionDenied("Must be enrolled to create discussions")
        
        serializer.save(created_by=self.request.user)


class DiscussionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DiscussionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        if self.request.user.is_admin:
            return Discussion.objects.all()
        elif self.request.user.is_instructor:
            return Discussion.objects.filter(course__instructor=self.request.user)
        else:
            enrolled_courses = Enrollment.objects.filter(
                student=self.request.user
            ).values_list('course_id', flat=True)
            return Discussion.objects.filter(course_id__in=enrolled_courses)
    
    def perform_update(self, serializer):
        # Only creator or instructor/admin can update
        if self.request.user != serializer.instance.created_by:
            if not (self.request.user.is_admin or 
                   serializer.instance.course.instructor == self.request.user):
                raise permissions.PermissionDenied("Can only edit your own discussions")
        serializer.save()
    
    def perform_destroy(self, instance):
        # Only creator or instructor/admin can delete
        if self.request.user != instance.created_by:
            if not (self.request.user.is_admin or instance.course.instructor == self.request.user):
                raise permissions.PermissionDenied("Can only delete your own discussions")
        instance.delete()


class CommentListView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        discussion_id = self.request.query_params.get('discussion_id')
        if not discussion_id:
            return Comment.objects.none()
        
        discussion = Discussion.objects.get(id=discussion_id)
        
        # Check permissions
        if self.request.user.is_student:
            if not Enrollment.objects.filter(student=self.request.user, course=discussion.course).exists():
                return Comment.objects.none()
        
        return Comment.objects.filter(discussion_id=discussion_id, parent_comment__isnull=True)
    
    def perform_create(self, serializer):
        discussion_id = self.request.data.get('discussion')
        if not discussion_id:
            raise serializers.ValidationError("discussion is required")
        
        discussion = Discussion.objects.get(id=discussion_id)
        
        if discussion.is_locked:
            raise permissions.PermissionDenied("Discussion is locked")
        
        # Check if student is enrolled or user is instructor/admin
        if self.request.user.is_student:
            if not Enrollment.objects.filter(student=self.request.user, course=discussion.course).exists():
                raise permissions.PermissionDenied("Must be enrolled to comment")
        
        serializer.save(created_by=self.request.user)


class CommentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        if self.request.user.is_admin:
            return Comment.objects.all()
        elif self.request.user.is_instructor:
            return Comment.objects.filter(discussion__course__instructor=self.request.user)
        else:
            enrolled_courses = Enrollment.objects.filter(
                student=self.request.user
            ).values_list('course_id', flat=True)
            return Comment.objects.filter(discussion__course_id__in=enrolled_courses)
    
    def perform_update(self, serializer):
        if self.request.user != serializer.instance.created_by:
            raise permissions.PermissionDenied("Can only edit your own comments")
        serializer.save(is_edited=True)
    
    def perform_destroy(self, instance):
        if self.request.user != instance.created_by:
            if not (self.request.user.is_admin or 
                   instance.discussion.course.instructor == self.request.user):
                raise permissions.PermissionDenied("Can only delete your own comments")
        instance.delete()


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def reply_to_comment(request, comment_id):
    try:
        parent_comment = Comment.objects.get(id=comment_id)
        discussion = parent_comment.discussion
        
        if discussion.is_locked:
            return Response({'error': 'Discussion is locked'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        # Check permissions
        if request.user.is_student:
            if not Enrollment.objects.filter(student=request.user, course=discussion.course).exists():
                return Response({'error': 'Must be enrolled to reply'}, 
                              status=status.HTTP_403_FORBIDDEN)
        
        content = request.data.get('content')
        if not content:
            return Response({'error': 'Content required'}, status=status.HTTP_400_BAD_REQUEST)
        
        comment = Comment.objects.create(
            discussion=discussion,
            parent_comment=parent_comment,
            content=content,
            created_by=request.user
        )
        
        serializer = CommentSerializer(comment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    except Comment.DoesNotExist:
        return Response({'error': 'Comment not found'}, status=status.HTTP_404_NOT_FOUND)

