from django.urls import path
from . import views

urlpatterns = [
    path('events/', views.record_engagement_event, name='gamification_events'),
    path('student/dashboard/', views.student_gamification_dashboard, name='gamification_student_dashboard'),
    path('course/<int:course_id>/summary/', views.course_gamification_summary, name='gamification_course_summary'),
    path('course/<int:course_id>/history/', views.course_gamification_history, name='gamification_course_history'),
    path('course/<int:course_id>/leaderboard/', views.course_leaderboard, name='gamification_course_leaderboard'),
]
