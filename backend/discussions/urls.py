from django.urls import path
from . import views

urlpatterns = [
    path('', views.DiscussionListView.as_view(), name='discussion_list'),
    path('<int:pk>/', views.DiscussionDetailView.as_view(), name='discussion_detail'),
    path('comments/', views.CommentListView.as_view(), name='comment_list'),
    path('comments/<int:pk>/', views.CommentDetailView.as_view(), name='comment_detail'),
    path('comments/<int:comment_id>/reply/', views.reply_to_comment, name='reply_to_comment'),
]

