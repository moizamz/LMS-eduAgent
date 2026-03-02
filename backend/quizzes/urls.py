from django.urls import path
from . import views

urlpatterns = [
    path('', views.QuizListView.as_view(), name='quiz_list'),
    path('questions/', views.QuestionListView.as_view(), name='question_list'),
    path('questions/<int:pk>/', views.QuestionDetailView.as_view(), name='question_detail'),
    path('choices/', views.ChoiceListView.as_view(), name='choice_list'),
    path('choices/<int:pk>/', views.ChoiceDetailView.as_view(), name='choice_detail'),
    path('generate-questions/', views.generate_questions, name='generate_questions'),
    path('chat/', views.chat_with_files, name='chat_with_files'),
    path('chat-sessions/', views.chat_session_list, name='chat_session_list'),
    path('chat-sessions/<int:pk>/', views.chat_session_detail, name='chat_session_detail'),
    path('practice-sessions/', views.practice_session_list_create, name='practice_session_list_create'),
    path('practice-sessions/<int:pk>/', views.practice_session_detail, name='practice_session_detail'),
    path('practice-sessions/<int:pk>/complete/', views.practice_session_complete, name='practice_session_complete'),
    path('import-questions/', views.import_questions, name='import_questions'),
    path('my-attempts/', views.my_quiz_attempts, name='my_quiz_attempts'),
    path('<int:quiz_id>/export/', views.export_quiz, name='export_quiz'),
    path('<int:quiz_id>/start/', views.start_quiz, name='start_quiz'),
    path('<int:quiz_id>/attempts/<int:attempt_id>/questions/', views.get_quiz_questions, name='get_quiz_questions'),
    path('<int:quiz_id>/attempts/<int:attempt_id>/submit/', views.submit_quiz, name='submit_quiz'),
    path('<int:quiz_id>/results/', views.quiz_results, name='quiz_results'),
    path('<int:pk>/', views.QuizDetailView.as_view(), name='quiz_detail'),
]