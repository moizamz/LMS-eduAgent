from django.urls import path
from . import views

urlpatterns = [
    path('', views.AssignmentListView.as_view(), name='assignment_list'),
    path('<int:pk>/', views.AssignmentDetailView.as_view(), name='assignment_detail'),
    path('<int:assignment_id>/submit/', views.submit_assignment, name='submit_assignment'),
    path('submissions/<int:submission_id>/', views.update_submission, name='update_submission'),
    path('submissions/<int:submission_id>/grade/', views.grade_submission, name='grade_submission'),
    path('my-submissions/', views.my_submissions, name='my_submissions'),
    path('<int:assignment_id>/submissions/', views.assignment_submissions, name='assignment_submissions'),
]

